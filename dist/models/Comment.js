"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommentModel = void 0;
const mongoose_1 = require("mongoose");
const commentSchema = new mongoose_1.Schema({
    postId: { type: mongoose_1.Types.ObjectId, ref: 'Post', required: true, index: true },
    authorId: {
        type: mongoose_1.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    parentCommentId: {
        type: mongoose_1.Types.ObjectId,
        ref: 'Comment',
        default: null,
        index: true,
    },
    content: { type: String, required: true, trim: true },
    likeCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
}, { timestamps: true });
commentSchema.index({ postId: 1, parentCommentId: 1, createdAt: -1 });
commentSchema.index({ postId: 1, createdAt: -1, _id: -1 });
commentSchema.index({ parentCommentId: 1, createdAt: 1, _id: 1 });
exports.CommentModel = (0, mongoose_1.model)('Comment', commentSchema);
