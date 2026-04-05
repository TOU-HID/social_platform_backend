import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { CommentModel } from '../models/Comment';
import { PostModel } from '../models/Post';
import { ReactionModel } from '../models/Reaction';
import { commentSchema } from '../utils/validators';
import {
  cacheKeys,
  invalidateAllReadCaches,
  readCache,
  writeCache,
} from '../cache/store';

const router = Router();

const ensurePostAccess = async (postId: string, userId: string) => {
  const post = await PostModel.findById(postId);
  if (!post) return null;
  if (post.visibility === 'private' && String(post.authorId) !== userId)
    return null;
  return post;
};

router.get(
  '/posts/:postId/comments',
  requireAuth,
  async (req: AuthRequest, res) => {
    const postId = String(req.params.postId);
    const userId = req.userId!;
    const cacheKey = cacheKeys.comments(userId, postId);
    const cached = readCache<{ items: unknown[] }>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const post = await ensurePostAccess(postId, userId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const userObjectId = new Types.ObjectId(userId);

    const topLevel = await CommentModel.find({
      postId: post._id,
      parentCommentId: null,
    })
      .sort({ createdAt: -1 })
      .populate('authorId', 'firstName lastName profileImageUrl')
      .lean();

    const topLevelIds = topLevel.map((comment) => comment._id);

    const replies = await CommentModel.find({
      parentCommentId: { $in: topLevelIds },
    })
      .sort({ createdAt: 1 })
      .populate('authorId', 'firstName lastName profileImageUrl')
      .lean();

    const allCommentIds = [
      ...topLevelIds,
      ...replies.map((reply) => reply._id),
    ];
    const myReactions = await ReactionModel.find({
      targetType: 'comment',
      targetId: { $in: allCommentIds },
      userId: userObjectId,
    }).lean();

    const reactionSet = new Set(
      myReactions.map((item) => String(item.targetId)),
    );

    const repliesByParent = new Map<string, typeof replies>();
    for (const reply of replies) {
      const key = String(reply.parentCommentId);
      if (!repliesByParent.has(key)) repliesByParent.set(key, []);
      repliesByParent.get(key)!.push(reply);
    }

    const items = topLevel.map((comment) => ({
      id: String(comment._id),
      postId: String(comment.postId),
      content: comment.content,
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      likedByMe: reactionSet.has(String(comment._id)),
      createdAt: comment.createdAt,
      author: {
        id: String(comment.authorId?._id ?? comment.authorId),
        firstName: (comment.authorId as { firstName?: string })?.firstName,
        lastName: (comment.authorId as { lastName?: string })?.lastName,
        profileImageUrl: (
          comment.authorId as { profileImageUrl?: string | null }
        )?.profileImageUrl,
      },
      replies: (repliesByParent.get(String(comment._id)) || []).map(
        (reply) => ({
          id: String(reply._id),
          parentCommentId: String(reply.parentCommentId),
          content: reply.content,
          likeCount: reply.likeCount,
          likedByMe: reactionSet.has(String(reply._id)),
          createdAt: reply.createdAt,
          author: {
            id: String(reply.authorId?._id ?? reply.authorId),
            firstName: (reply.authorId as { firstName?: string })?.firstName,
            lastName: (reply.authorId as { lastName?: string })?.lastName,
            profileImageUrl: (
              reply.authorId as { profileImageUrl?: string | null }
            )?.profileImageUrl,
          },
        }),
      ),
    }));

    const payload = { items };
    writeCache(cacheKey, payload);
    return res.json(payload);
  },
);

router.post(
  '/posts/:postId/comments',
  requireAuth,
  async (req: AuthRequest, res) => {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }

    const post = await ensurePostAccess(String(req.params.postId), req.userId!);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const comment = await CommentModel.create({
      postId: post._id,
      authorId: req.userId,
      content: parsed.data.content,
      parentCommentId: null,
    });

    await PostModel.findByIdAndUpdate(post._id, { $inc: { commentCount: 1 } });
    invalidateAllReadCaches();

    return res.status(201).json(comment);
  },
);

router.post(
  '/comments/:commentId/replies',
  requireAuth,
  async (req: AuthRequest, res) => {
    const parsed = commentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }

    const parentComment = await CommentModel.findById(req.params.commentId);
    if (!parentComment) {
      return res.status(404).json({ message: 'Parent comment not found' });
    }

    const post = await ensurePostAccess(
      String(parentComment.postId),
      req.userId!,
    );
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const reply = await CommentModel.create({
      postId: parentComment.postId,
      authorId: req.userId,
      content: parsed.data.content,
      parentCommentId: parentComment._id,
    });

    await CommentModel.findByIdAndUpdate(parentComment._id, {
      $inc: { replyCount: 1 },
    });
    await PostModel.findByIdAndUpdate(parentComment.postId, {
      $inc: { commentCount: 1 },
    });
    invalidateAllReadCaches();

    return res.status(201).json(reply);
  },
);

router.delete(
  '/comments/:commentId',
  requireAuth,
  async (req: AuthRequest, res) => {
    const comment = await CommentModel.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (String(comment.authorId) !== req.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const childReplies = await CommentModel.find({
      parentCommentId: comment._id,
    }).select('_id');
    const targetIds = [comment._id, ...childReplies.map((reply) => reply._id)];

    await ReactionModel.deleteMany({
      targetType: 'comment',
      targetId: { $in: targetIds },
    });
    await CommentModel.deleteMany({ _id: { $in: targetIds } });

    const decrement = targetIds.length;
    await PostModel.findByIdAndUpdate(comment.postId, {
      $inc: { commentCount: -decrement },
    });

    if (comment.parentCommentId) {
      await CommentModel.findByIdAndUpdate(comment.parentCommentId, {
        $inc: { replyCount: -1 },
      });
    }

    invalidateAllReadCaches();

    return res.json({ message: 'Comment deleted' });
  },
);

export default router;
