"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const Reaction_1 = require("../models/Reaction");
const Post_1 = require("../models/Post");
const Comment_1 = require("../models/Comment");
const User_1 = require("../models/User");
const validators_1 = require("../utils/validators");
const store_1 = require("../cache/store");
const router = (0, express_1.Router)();
const ensureTargetVisible = async (targetType, targetId, userId) => {
    if (targetType === 'post') {
        const post = await Post_1.PostModel.findById(targetId);
        if (!post)
            return null;
        if (post.visibility === 'private' && String(post.authorId) !== userId)
            return null;
        return { post, comment: null };
    }
    const comment = await Comment_1.CommentModel.findById(targetId);
    if (!comment)
        return null;
    const post = await Post_1.PostModel.findById(comment.postId);
    if (!post)
        return null;
    if (post.visibility === 'private' && String(post.authorId) !== userId)
        return null;
    return { post: null, comment };
};
router.put('/', auth_1.requireAuth, async (req, res) => {
    const parsed = validators_1.reactionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const { targetType, targetId, active } = parsed.data;
    const access = await ensureTargetVisible(targetType, targetId, req.userId);
    if (!access) {
        return res.status(404).json({ message: 'Target not found' });
    }
    const existing = await Reaction_1.ReactionModel.findOne({
        targetType,
        targetId,
        userId: req.userId,
    });
    if (active && !existing) {
        await Reaction_1.ReactionModel.create({ targetType, targetId, userId: req.userId });
        if (targetType === 'post') {
            await Post_1.PostModel.findByIdAndUpdate(targetId, { $inc: { likeCount: 1 } });
        }
        else {
            await Comment_1.CommentModel.findByIdAndUpdate(targetId, {
                $inc: { likeCount: 1 },
            });
        }
        (0, store_1.invalidateAllReadCaches)();
    }
    if (!active && existing) {
        await existing.deleteOne();
        if (targetType === 'post') {
            await Post_1.PostModel.findByIdAndUpdate(targetId, { $inc: { likeCount: -1 } });
        }
        else {
            await Comment_1.CommentModel.findByIdAndUpdate(targetId, {
                $inc: { likeCount: -1 },
            });
        }
        (0, store_1.invalidateAllReadCaches)();
    }
    return res.json({
        targetType,
        targetId,
        active,
    });
});
router.get('/likers', auth_1.requireAuth, async (req, res) => {
    const targetType = req.query.targetType;
    const targetId = req.query.targetId;
    if (!targetType || !targetId || !['post', 'comment'].includes(targetType)) {
        return res.status(400).json({ message: 'Invalid query params' });
    }
    const access = await ensureTargetVisible(targetType, targetId, req.userId);
    if (!access) {
        return res.status(404).json({ message: 'Target not found' });
    }
    const cacheKey = store_1.cacheKeys.likers(req.userId, targetType, targetId);
    const cached = (0, store_1.readCache)(cacheKey);
    if (cached) {
        return res.json(cached);
    }
    const reactions = await Reaction_1.ReactionModel.find({ targetType, targetId })
        .select('userId createdAt')
        .sort({ createdAt: -1 })
        .lean();
    const userIds = reactions.map((item) => item.userId);
    const users = await User_1.UserModel.find({ _id: { $in: userIds } })
        .select('firstName lastName email')
        .lean();
    const map = new Map(users.map((user) => [String(user._id), user]));
    const likers = reactions
        .map((reaction) => {
        const user = map.get(String(reaction.userId));
        if (!user)
            return null;
        return {
            id: String(user._id),
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
        };
    })
        .filter(Boolean);
    const payload = { items: likers };
    (0, store_1.writeCache)(cacheKey, payload);
    return res.json(payload);
});
exports.default = router;
