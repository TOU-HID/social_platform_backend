"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const auth_1 = require("../middleware/auth");
const Comment_1 = require("../models/Comment");
const Post_1 = require("../models/Post");
const Reaction_1 = require("../models/Reaction");
const validators_1 = require("../utils/validators");
const store_1 = require("../cache/store");
const router = (0, express_1.Router)();
const ensurePostAccess = async (postId, userId) => {
    const post = await Post_1.PostModel.findById(postId);
    if (!post)
        return null;
    if (post.visibility === 'private' && String(post.authorId) !== userId)
        return null;
    return post;
};
router.get('/posts/:postId/comments', auth_1.requireAuth, async (req, res) => {
    const postId = String(req.params.postId);
    const userId = req.userId;
    const cacheKey = store_1.cacheKeys.comments(userId, postId);
    const cached = (0, store_1.readCache)(cacheKey);
    if (cached) {
        return res.json(cached);
    }
    const post = await ensurePostAccess(postId, userId);
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }
    const userObjectId = new mongoose_1.Types.ObjectId(userId);
    const topLevel = await Comment_1.CommentModel.find({
        postId: post._id,
        parentCommentId: null,
    })
        .sort({ createdAt: -1 })
        .populate('authorId', 'firstName lastName profileImageUrl')
        .lean();
    const topLevelIds = topLevel.map((comment) => comment._id);
    const replies = await Comment_1.CommentModel.find({
        parentCommentId: { $in: topLevelIds },
    })
        .sort({ createdAt: 1 })
        .populate('authorId', 'firstName lastName profileImageUrl')
        .lean();
    const allCommentIds = [
        ...topLevelIds,
        ...replies.map((reply) => reply._id),
    ];
    const myReactions = await Reaction_1.ReactionModel.find({
        targetType: 'comment',
        targetId: { $in: allCommentIds },
        userId: userObjectId,
    }).lean();
    const reactionSet = new Set(myReactions.map((item) => String(item.targetId)));
    const repliesByParent = new Map();
    for (const reply of replies) {
        const key = String(reply.parentCommentId);
        if (!repliesByParent.has(key))
            repliesByParent.set(key, []);
        repliesByParent.get(key).push(reply);
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
            firstName: comment.authorId?.firstName,
            lastName: comment.authorId?.lastName,
            profileImageUrl: comment.authorId?.profileImageUrl,
        },
        replies: (repliesByParent.get(String(comment._id)) || []).map((reply) => ({
            id: String(reply._id),
            parentCommentId: String(reply.parentCommentId),
            content: reply.content,
            likeCount: reply.likeCount,
            likedByMe: reactionSet.has(String(reply._id)),
            createdAt: reply.createdAt,
            author: {
                id: String(reply.authorId?._id ?? reply.authorId),
                firstName: reply.authorId?.firstName,
                lastName: reply.authorId?.lastName,
                profileImageUrl: reply.authorId?.profileImageUrl,
            },
        })),
    }));
    const payload = { items };
    (0, store_1.writeCache)(cacheKey, payload);
    return res.json(payload);
});
router.post('/posts/:postId/comments', auth_1.requireAuth, async (req, res) => {
    const parsed = validators_1.commentSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const post = await ensurePostAccess(String(req.params.postId), req.userId);
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }
    const comment = await Comment_1.CommentModel.create({
        postId: post._id,
        authorId: req.userId,
        content: parsed.data.content,
        parentCommentId: null,
    });
    await Post_1.PostModel.findByIdAndUpdate(post._id, { $inc: { commentCount: 1 } });
    (0, store_1.invalidateAllReadCaches)();
    return res.status(201).json(comment);
});
router.post('/comments/:commentId/replies', auth_1.requireAuth, async (req, res) => {
    const parsed = validators_1.commentSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const parentComment = await Comment_1.CommentModel.findById(req.params.commentId);
    if (!parentComment) {
        return res.status(404).json({ message: 'Parent comment not found' });
    }
    const post = await ensurePostAccess(String(parentComment.postId), req.userId);
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }
    const reply = await Comment_1.CommentModel.create({
        postId: parentComment.postId,
        authorId: req.userId,
        content: parsed.data.content,
        parentCommentId: parentComment._id,
    });
    await Comment_1.CommentModel.findByIdAndUpdate(parentComment._id, {
        $inc: { replyCount: 1 },
    });
    await Post_1.PostModel.findByIdAndUpdate(parentComment.postId, {
        $inc: { commentCount: 1 },
    });
    (0, store_1.invalidateAllReadCaches)();
    return res.status(201).json(reply);
});
router.delete('/comments/:commentId', auth_1.requireAuth, async (req, res) => {
    const comment = await Comment_1.CommentModel.findById(req.params.commentId);
    if (!comment) {
        return res.status(404).json({ message: 'Comment not found' });
    }
    if (String(comment.authorId) !== req.userId) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    const childReplies = await Comment_1.CommentModel.find({
        parentCommentId: comment._id,
    }).select('_id');
    const targetIds = [comment._id, ...childReplies.map((reply) => reply._id)];
    await Reaction_1.ReactionModel.deleteMany({
        targetType: 'comment',
        targetId: { $in: targetIds },
    });
    await Comment_1.CommentModel.deleteMany({ _id: { $in: targetIds } });
    const decrement = targetIds.length;
    await Post_1.PostModel.findByIdAndUpdate(comment.postId, {
        $inc: { commentCount: -decrement },
    });
    if (comment.parentCommentId) {
        await Comment_1.CommentModel.findByIdAndUpdate(comment.parentCommentId, {
            $inc: { replyCount: -1 },
        });
    }
    (0, store_1.invalidateAllReadCaches)();
    return res.json({ message: 'Comment deleted' });
});
exports.default = router;
