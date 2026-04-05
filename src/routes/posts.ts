import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import { Types } from 'mongoose';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { PostModel } from '../models/Post';
import { ReactionModel } from '../models/Reaction';
import { CommentModel } from '../models/Comment';
import { UserModel } from '../models/User';
import { createPostSchema, updatePostSchema } from '../utils/validators';
import { uploadDir } from '../config/paths';
import { env } from '../config/env';
import { uploadImageBufferToCloudinary } from '../config/cloudinary';
import {
  cacheKeys,
  invalidateAllReadCaches,
  readCache,
  writeCache,
} from '../cache/store';

const router = Router();
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: env.useCloudinary
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) =>
          cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
      }),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only image uploads are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

const canAccessPost = async (postId: string, userId: string) => {
  const post = await PostModel.findById(postId);
  if (!post) return null;
  if (post.visibility === 'private' && String(post.authorId) !== userId)
    return null;
  return post;
};

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const limit = Math.min(Number(req.query.limit || 20), 50);
  const cursorCreatedAt = req.query.cursorCreatedAt as string | undefined;
  const cursorId = req.query.cursorId as string | undefined;

  const visibilityFilter = {
    $or: [{ visibility: 'public' }, { authorId: new Types.ObjectId(userId) }],
  } as const;

  const query: Record<string, unknown> = { ...visibilityFilter };
  const cacheKey = cacheKeys.feed(userId, cursorCreatedAt, cursorId, limit);
  const cached = readCache<{ items: unknown[]; nextCursor: unknown }>(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  if (cursorCreatedAt && cursorId) {
    const createdAtDate = new Date(cursorCreatedAt);
    if (!Number.isNaN(createdAtDate.getTime())) {
      query.$and = [
        visibilityFilter,
        {
          $or: [
            { createdAt: { $lt: createdAtDate } },
            {
              createdAt: createdAtDate,
              _id: { $lt: new Types.ObjectId(cursorId) },
            },
          ],
        },
      ];
      delete query.$or;
    }
  }

  const posts = await PostModel.find(query)
    .select(
      'authorId content imageUrl visibility likeCount commentCount createdAt updatedAt',
    )
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .populate('authorId', 'firstName lastName profileImageUrl')
    .lean();

  const postIds = posts.map((post) => post._id);

  if (postIds.length === 0) {
    return res.json({ items: [], nextCursor: null });
  }

  const reactions = await ReactionModel.find({
    targetType: 'post',
    targetId: { $in: postIds },
    userId: new Types.ObjectId(userId),
  })
    .select('targetId')
    .lean();

  const likedMap = new Set(
    reactions.map((reaction) => String(reaction.targetId)),
  );

  const recentPostReactions = await ReactionModel.find({
    targetType: 'post',
    targetId: { $in: postIds },
  })
    .select('targetId userId createdAt')
    .sort({ createdAt: -1 })
    .lean();

  const recentLikerUserIds = [
    ...new Set(recentPostReactions.map((reaction) => String(reaction.userId))),
  ];

  const recentLikerUsers = await UserModel.find({
    _id: { $in: recentLikerUserIds },
  })
    .select('firstName lastName profileImageUrl')
    .lean();

  const recentLikerUserMap = new Map(
    recentLikerUsers.map((item) => [String(item._id), item]),
  );

  const recentLikersByPost = new Map<
    string,
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      profileImageUrl: string | null;
    }>
  >();

  for (const reaction of recentPostReactions) {
    const postKey = String(reaction.targetId);
    const current = recentLikersByPost.get(postKey) || [];
    if (current.length >= 5) continue;

    const user = recentLikerUserMap.get(String(reaction.userId));
    if (!user) continue;

    current.push({
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl || null,
    });
    recentLikersByPost.set(postKey, current);
  }

  const response = posts.map((post) => ({
    id: String(post._id),
    content: post.content,
    imageUrl: post.imageUrl,
    visibility: post.visibility,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    likedByMe: likedMap.has(String(post._id)),
    recentLikers: recentLikersByPost.get(String(post._id)) || [],
    author: {
      id: String(post.authorId?._id ?? post.authorId),
      firstName: (post.authorId as { firstName?: string })?.firstName,
      lastName: (post.authorId as { lastName?: string })?.lastName,
      profileImageUrl: (post.authorId as { profileImageUrl?: string | null })
        ?.profileImageUrl,
    },
  }));

  const payload = {
    items: response,
    nextCursor:
      response.length === limit
        ? {
            cursorCreatedAt: response[response.length - 1].createdAt,
            cursorId: response[response.length - 1].id,
          }
        : null,
  };

  writeCache(cacheKey, payload);
  return res.json(payload);
});

router.post(
  '/',
  requireAuth,
  upload.single('image'),
  async (req: AuthRequest, res) => {
    const parsed = createPostSchema.safeParse({
      content: req.body.content,
      visibility: req.body.visibility,
    });

    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }

    const { content, visibility } = parsed.data;

    if (!content && !req.file) {
      return res
        .status(400)
        .json({ message: 'Post must contain text or image' });
    }

    let imageUrl: string | null = null;
    if (req.file) {
      if (env.useCloudinary) {
        if (!req.file.buffer) {
          return res
            .status(500)
            .json({ message: 'Failed to process image buffer' });
        }
        imageUrl = await uploadImageBufferToCloudinary(req.file.buffer);
      } else {
        imageUrl = `/uploads/${req.file.filename}`;
      }
    }

    const post = await PostModel.create({
      authorId: req.userId,
      content,
      visibility,
      imageUrl,
    });

    invalidateAllReadCaches();

    return res.status(201).json({
      id: String(post._id),
      content: post.content,
      imageUrl: post.imageUrl,
      visibility: post.visibility,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
    });
  },
);

router.get('/:postId', requireAuth, async (req: AuthRequest, res) => {
  const post = await canAccessPost(String(req.params.postId), req.userId!);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  return res.json(post);
});

router.patch(
  '/:postId',
  requireAuth,
  upload.single('image'),
  async (req: AuthRequest, res) => {
    const parsed = updatePostSchema.safeParse({
      content: req.body.content,
      visibility: req.body.visibility,
      removeImage: req.body.removeImage,
    });

    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }

    const post = await PostModel.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (String(post.authorId) !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { content, visibility, removeImage } = parsed.data;

    if (typeof content !== 'undefined') {
      post.content = content;
    }

    if (visibility) {
      post.visibility = visibility;
    }

    if (req.file) {
      if (env.useCloudinary) {
        if (!req.file.buffer) {
          return res
            .status(500)
            .json({ message: 'Failed to process image buffer' });
        }
        post.imageUrl = await uploadImageBufferToCloudinary(req.file.buffer);
      } else {
        post.imageUrl = `/uploads/${req.file.filename}`;
      }
    } else if (removeImage) {
      post.imageUrl = null;
    }

    if (!post.content && !post.imageUrl) {
      return res
        .status(400)
        .json({ message: 'Post must contain text or image' });
    }

    await post.save();
    invalidateAllReadCaches();

    return res.json({
      id: String(post._id),
      content: post.content,
      imageUrl: post.imageUrl,
      visibility: post.visibility,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    });
  },
);

router.delete('/:postId', requireAuth, async (req: AuthRequest, res) => {
  const post = await PostModel.findById(req.params.postId);
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }

  if (String(post.authorId) !== req.userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const commentIds = (
    await CommentModel.find({ postId: post._id }).select('_id').lean()
  ).map((item) => item._id);

  await CommentModel.deleteMany({ postId: post._id });
  await ReactionModel.deleteMany({
    $or: [
      { targetType: 'post', targetId: post._id },
      { targetType: 'comment', targetId: { $in: commentIds } },
    ],
  });
  await post.deleteOne();
  invalidateAllReadCaches();

  return res.json({ message: 'Post deleted' });
});

export default router;
