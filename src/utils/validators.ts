import { z } from 'zod';

export const registerSchema = z.object({
  firstName: z.string().trim().min(2).optional(),
  lastName: z.string().trim().min(2).optional(),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(6),
  repeatPassword: z.string().min(6).optional(),
});

export const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(6),
});

export const updateProfileSchema = z
  .object({
    firstName: z.string().trim().min(2).max(50).optional(),
    lastName: z.string().trim().min(2).max(50).optional(),
  })
  .refine(
    (value) =>
      typeof value.firstName !== 'undefined' ||
      typeof value.lastName !== 'undefined',
    {
      message: 'At least one field is required',
    },
  );

export const createPostSchema = z.object({
  content: z.string().trim().max(2000).optional().default(''),
  visibility: z.enum(['public', 'private']).default('public'),
});

export const updatePostSchema = z.object({
  content: z.string().trim().max(2000).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  removeImage: z.coerce.boolean().optional(),
});

export const reactionSchema = z.object({
  targetType: z.enum(['post', 'comment']),
  targetId: z.string().min(1),
  active: z.boolean(),
});

export const commentSchema = z.object({
  content: z.string().trim().min(1).max(1000),
});
