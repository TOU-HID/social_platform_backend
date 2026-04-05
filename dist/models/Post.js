"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostModel = void 0;
const mongoose_1 = require("mongoose");
const postSchema = new mongoose_1.Schema({
    authorId: {
        type: mongoose_1.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    content: { type: String, default: '', trim: true },
    imageUrl: { type: String, default: null },
    visibility: {
        type: String,
        enum: ['public', 'private'],
        default: 'public',
        index: true,
    },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
}, { timestamps: true });
postSchema.index({ visibility: 1, createdAt: -1 });
postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1, _id: -1 });
postSchema.index({ authorId: 1, createdAt: -1, _id: -1 });
exports.PostModel = (0, mongoose_1.model)('Post', postSchema);
