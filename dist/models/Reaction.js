"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactionModel = void 0;
const mongoose_1 = require("mongoose");
const reactionSchema = new mongoose_1.Schema({
    targetType: {
        type: String,
        enum: ['post', 'comment'],
        required: true,
        index: true,
    },
    targetId: { type: mongoose_1.Types.ObjectId, required: true, index: true },
    userId: { type: mongoose_1.Types.ObjectId, ref: 'User', required: true, index: true },
}, { timestamps: true });
reactionSchema.index({ targetType: 1, targetId: 1, userId: 1 }, { unique: true });
reactionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
reactionSchema.index({ userId: 1, createdAt: -1 });
exports.ReactionModel = (0, mongoose_1.model)('Reaction', reactionSchema);
