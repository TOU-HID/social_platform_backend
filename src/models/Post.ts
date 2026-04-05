import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const postSchema = new Schema(
  {
    authorId: {
      type: Types.ObjectId,
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
  },
  { timestamps: true },
);

postSchema.index({ visibility: 1, createdAt: -1 });
postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ visibility: 1, createdAt: -1, _id: -1 });
postSchema.index({ authorId: 1, createdAt: -1, _id: -1 });

export type PostDocument = InferSchemaType<typeof postSchema> & { _id: string };

export const PostModel = model('Post', postSchema);
