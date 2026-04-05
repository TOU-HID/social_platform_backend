"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const node_fs_1 = __importDefault(require("node:fs"));
const mongoose_1 = require("mongoose");
const auth_1 = require("../middleware/auth");
const Post_1 = require("../models/Post");
const Reaction_1 = require("../models/Reaction");
const Comment_1 = require("../models/Comment");
const User_1 = require("../models/User");
const validators_1 = require("../utils/validators");
const paths_1 = require("../config/paths");
const env_1 = require("../config/env");
const cloudinary_1 = require("../config/cloudinary");
const store_1 = require("../cache/store");
const router = (0, express_1.Router)();
if (!node_fs_1.default.existsSync(paths_1.uploadDir))
    node_fs_1.default.mkdirSync(paths_1.uploadDir, { recursive: true });
const upload = (0, multer_1.default)({
    storage: env_1.env.useCloudinary
        ? multer_1.default.memoryStorage()
        : multer_1.default.diskStorage({
            destination: (_req, _file, cb) => cb(null, paths_1.uploadDir),
            filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`),
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
const canAccessPost = async (postId, userId) => {
    const post = await Post_1.PostModel.findById(postId);
    if (!post)
        return null;
    if (post.visibility === 'private' && String(post.authorId) !== userId)
        return null;
    return post;
};
router.get('/', auth_1.requireAuth, async (req, res) => {
    const userId = req.userId;
    const limit = Math.min(Number(req.query.limit || 20), 50);
    const cursorCreatedAt = req.query.cursorCreatedAt;
    const cursorId = req.query.cursorId;
    const visibilityFilter = {
        $or: [{ visibility: 'public' }, { authorId: new mongoose_1.Types.ObjectId(userId) }],
    };
    const query = { ...visibilityFilter };
    const cacheKey = store_1.cacheKeys.feed(userId, cursorCreatedAt, cursorId, limit);
    const cached = (0, store_1.readCache)(cacheKey);
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
                            _id: { $lt: new mongoose_1.Types.ObjectId(cursorId) },
                        },
                    ],
                },
            ];
            delete query.$or;
        }
    }
    const posts = await Post_1.PostModel.find(query)
        .select('authorId content imageUrl visibility likeCount commentCount createdAt updatedAt')
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .populate('authorId', 'firstName lastName profileImageUrl')
        .lean();
    const postIds = posts.map((post) => post._id);
    if (postIds.length === 0) {
        return res.json({ items: [], nextCursor: null });
    }
    const reactions = await Reaction_1.ReactionModel.find({
        targetType: 'post',
        targetId: { $in: postIds },
        userId: new mongoose_1.Types.ObjectId(userId),
    })
        .select('targetId')
        .lean();
    const likedMap = new Set(reactions.map((reaction) => String(reaction.targetId)));
    const recentPostReactions = await Reaction_1.ReactionModel.find({
        targetType: 'post',
        targetId: { $in: postIds },
    })
        .select('targetId userId createdAt')
        .sort({ createdAt: -1 })
        .lean();
    const recentLikerUserIds = [
        ...new Set(recentPostReactions.map((reaction) => String(reaction.userId))),
    ];
    const recentLikerUsers = await User_1.UserModel.find({
        _id: { $in: recentLikerUserIds },
    })
        .select('firstName lastName profileImageUrl')
        .lean();
    const recentLikerUserMap = new Map(recentLikerUsers.map((item) => [String(item._id), item]));
    const recentLikersByPost = new Map();
    for (const reaction of recentPostReactions) {
        const postKey = String(reaction.targetId);
        const current = recentLikersByPost.get(postKey) || [];
        if (current.length >= 5)
            continue;
        const user = recentLikerUserMap.get(String(reaction.userId));
        if (!user)
            continue;
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
            firstName: post.authorId?.firstName,
            lastName: post.authorId?.lastName,
            profileImageUrl: post.authorId
                ?.profileImageUrl,
        },
    }));
    const payload = {
        items: response,
        nextCursor: response.length === limit
            ? {
                cursorCreatedAt: response[response.length - 1].createdAt,
                cursorId: response[response.length - 1].id,
            }
            : null,
    };
    (0, store_1.writeCache)(cacheKey, payload);
    return res.json(payload);
});
router.post('/', auth_1.requireAuth, upload.single('image'), async (req, res) => {
    const parsed = validators_1.createPostSchema.safeParse({
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
    let imageUrl = null;
    if (req.file) {
        if (env_1.env.useCloudinary) {
            if (!req.file.buffer) {
                return res
                    .status(500)
                    .json({ message: 'Failed to process image buffer' });
            }
            imageUrl = await (0, cloudinary_1.uploadImageBufferToCloudinary)(req.file.buffer);
        }
        else {
            imageUrl = `/uploads/${req.file.filename}`;
        }
    }
    const post = await Post_1.PostModel.create({
        authorId: req.userId,
        content,
        visibility,
        imageUrl,
    });
    (0, store_1.invalidateAllReadCaches)();
    return res.status(201).json({
        id: String(post._id),
        content: post.content,
        imageUrl: post.imageUrl,
        visibility: post.visibility,
        likeCount: post.likeCount,
        commentCount: post.commentCount,
        createdAt: post.createdAt,
    });
});
router.get('/:postId', auth_1.requireAuth, async (req, res) => {
    const post = await canAccessPost(String(req.params.postId), req.userId);
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }
    return res.json(post);
});
router.patch('/:postId', auth_1.requireAuth, upload.single('image'), async (req, res) => {
    const parsed = validators_1.updatePostSchema.safeParse({
        content: req.body.content,
        visibility: req.body.visibility,
        removeImage: req.body.removeImage,
    });
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: 'Invalid payload', errors: parsed.error.issues });
    }
    const post = await Post_1.PostModel.findById(req.params.postId);
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
        if (env_1.env.useCloudinary) {
            if (!req.file.buffer) {
                return res
                    .status(500)
                    .json({ message: 'Failed to process image buffer' });
            }
            post.imageUrl = await (0, cloudinary_1.uploadImageBufferToCloudinary)(req.file.buffer);
        }
        else {
            post.imageUrl = `/uploads/${req.file.filename}`;
        }
    }
    else if (removeImage) {
        post.imageUrl = null;
    }
    if (!post.content && !post.imageUrl) {
        return res
            .status(400)
            .json({ message: 'Post must contain text or image' });
    }
    await post.save();
    (0, store_1.invalidateAllReadCaches)();
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
});
router.delete('/:postId', auth_1.requireAuth, async (req, res) => {
    const post = await Post_1.PostModel.findById(req.params.postId);
    if (!post) {
        return res.status(404).json({ message: 'Post not found' });
    }
    if (String(post.authorId) !== req.userId) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    const commentIds = (await Comment_1.CommentModel.find({ postId: post._id }).select('_id').lean()).map((item) => item._id);
    await Comment_1.CommentModel.deleteMany({ postId: post._id });
    await Reaction_1.ReactionModel.deleteMany({
        $or: [
            { targetType: 'post', targetId: post._id },
            { targetType: 'comment', targetId: { $in: commentIds } },
        ],
    });
    await post.deleteOne();
    (0, store_1.invalidateAllReadCaches)();
    return res.json({ message: 'Post deleted' });
});
exports.default = router;
