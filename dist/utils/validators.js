"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentSchema = exports.reactionSchema = exports.updatePostSchema = exports.createPostSchema = exports.updateProfileSchema = exports.loginSchema = exports.registerSchema = void 0;
const zod_1 = require("zod");
exports.registerSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(2).max(50),
    lastName: zod_1.z.string().trim().min(2).max(50),
    email: zod_1.z.email().trim().toLowerCase(),
    password: zod_1.z.string().min(6),
    confirmPassword: zod_1.z.string().min(6),
});
exports.loginSchema = zod_1.z.object({
    email: zod_1.z.email().trim().toLowerCase(),
    password: zod_1.z.string().min(6),
});
exports.updateProfileSchema = zod_1.z
    .object({
    firstName: zod_1.z.string().trim().min(2).max(50).optional(),
    lastName: zod_1.z.string().trim().min(2).max(50).optional(),
})
    .refine((value) => typeof value.firstName !== 'undefined' ||
    typeof value.lastName !== 'undefined', {
    message: 'At least one field is required',
});
exports.createPostSchema = zod_1.z.object({
    content: zod_1.z.string().trim().max(2000).optional().default(''),
    visibility: zod_1.z.enum(['public', 'private']).default('public'),
});
exports.updatePostSchema = zod_1.z.object({
    content: zod_1.z.string().trim().max(2000).optional(),
    visibility: zod_1.z.enum(['public', 'private']).optional(),
    removeImage: zod_1.z.coerce.boolean().optional(),
});
exports.reactionSchema = zod_1.z.object({
    targetType: zod_1.z.enum(['post', 'comment']),
    targetId: zod_1.z.string().min(1),
    active: zod_1.z.boolean(),
});
exports.commentSchema = zod_1.z.object({
    content: zod_1.z.string().trim().min(1).max(1000),
});
