import { Schema, model, Types, type InferSchemaType } from 'mongoose';

const reactionSchema = new Schema(
  {
    targetType: {
      type: String,
      enum: ['post', 'comment'],
      required: true,
      index: true,
    },
    targetId: { type: Types.ObjectId, required: true, index: true },
    userId: { type: Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

reactionSchema.index(
  { targetType: 1, targetId: 1, userId: 1 },
  { unique: true },
);
reactionSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
reactionSchema.index({ userId: 1, createdAt: -1 });

export type ReactionDocument = InferSchemaType<typeof reactionSchema> & {
  _id: string;
};

export const ReactionModel = model('Reaction', reactionSchema);
