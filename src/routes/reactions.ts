import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth, type AuthRequest } from '../middleware/auth';
import { ReactionModel } from '../models/Reaction';
import { PostModel } from '../models/Post';
import { CommentModel } from '../models/Comment';
import { UserModel } from '../models/User';
import { reactionSchema } from '../utils/validators';
import {
  cacheKeys,
  invalidateAllReadCaches,
  readCache,
  writeCache,
} from '../cache/store';

const router = Router();

const ensureTargetVisible = async (
  targetType: 'post' | 'comment',
  targetId: string,
  userId: string,
) => {
  if (targetType === 'post') {
    const post = await PostModel.findById(targetId);
    if (!post) return null;
    if (post.visibility === 'private' && String(post.authorId) !== userId)
      return null;
    return { post, comment: null };
  }

  const comment = await CommentModel.findById(targetId);
  if (!comment) return null;
  const post = await PostModel.findById(comment.postId);
  if (!post) return null;
  if (post.visibility === 'private' && String(post.authorId) !== userId)
    return null;
  return { post: null, comment };
};

router.put('/', requireAuth, async (req: AuthRequest, res) => {
  const parsed = reactionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: 'Invalid payload', errors: parsed.error.issues });
  }

  const { targetType, targetId, active } = parsed.data;
  const access = await ensureTargetVisible(targetType, targetId, req.userId!);
  if (!access) {
    return res.status(404).json({ message: 'Target not found' });
  }

  const existing = await ReactionModel.findOne({
    targetType,
    targetId,
    userId: req.userId,
  });

  if (active && !existing) {
    await ReactionModel.create({ targetType, targetId, userId: req.userId });
    if (targetType === 'post') {
      await PostModel.findByIdAndUpdate(targetId, { $inc: { likeCount: 1 } });
    } else {
      await CommentModel.findByIdAndUpdate(targetId, {
        $inc: { likeCount: 1 },
      });
    }
    invalidateAllReadCaches();
  }

  if (!active && existing) {
    await existing.deleteOne();
    if (targetType === 'post') {
      await PostModel.findByIdAndUpdate(targetId, { $inc: { likeCount: -1 } });
    } else {
      await CommentModel.findByIdAndUpdate(targetId, {
        $inc: { likeCount: -1 },
      });
    }
    invalidateAllReadCaches();
  }

  return res.json({
    targetType,
    targetId,
    active,
  });
});

router.get('/likers', requireAuth, async (req: AuthRequest, res) => {
  const targetType = req.query.targetType as 'post' | 'comment';
  const targetId = req.query.targetId as string;

  if (!targetType || !targetId || !['post', 'comment'].includes(targetType)) {
    return res.status(400).json({ message: 'Invalid query params' });
  }

  const access = await ensureTargetVisible(targetType, targetId, req.userId!);
  if (!access) {
    return res.status(404).json({ message: 'Target not found' });
  }

  const cacheKey = cacheKeys.likers(req.userId!, targetType, targetId);
  const cached = readCache<{ items: unknown[] }>(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const reactions = await ReactionModel.find({ targetType, targetId })
    .select('userId createdAt')
    .sort({ createdAt: -1 })
    .lean();
  const userIds = reactions.map((item) => item.userId);

  const users = await UserModel.find({ _id: { $in: userIds } })
    .select('firstName lastName email')
    .lean();
  const map = new Map(users.map((user) => [String(user._id), user]));

  const likers = reactions
    .map((reaction) => {
      const user = map.get(String(reaction.userId));
      if (!user) return null;
      return {
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      };
    })
    .filter(Boolean);

  const payload = { items: likers };
  writeCache(cacheKey, payload);
  return res.json(payload);
});

export default router;
