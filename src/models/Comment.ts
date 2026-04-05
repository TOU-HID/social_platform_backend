import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const commentSchema = new Schema(
  {
    postId: { type: Types.ObjectId, ref: 'Post', required: true, index: true },
    authorId: {
      type: Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parentCommentId: {
      type: Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    content: { type: String, required: true, trim: true },
    likeCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

commentSchema.index({ postId: 1, parentCommentId: 1, createdAt: -1 });
commentSchema.index({ postId: 1, createdAt: -1, _id: -1 });
commentSchema.index({ parentCommentId: 1, createdAt: 1, _id: 1 });

export type CommentDocument = InferSchemaType<typeof commentSchema> & {
  _id: string;
};

export const CommentModel = model('Comment', commentSchema);
