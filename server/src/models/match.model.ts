import mongoose, { Schema, Document } from 'mongoose';

export interface IMatch extends Document {
  user1Id: mongoose.Types.ObjectId | string;
  user2Id: mongoose.Types.ObjectId | string;
  interestId: mongoose.Types.ObjectId | string;
  createdAt: Date;
}

const MatchSchema = new Schema<IMatch>(
  {
    user1Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user2Id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    interestId: {
      type: Schema.Types.ObjectId,
      ref: 'Interest',
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Unique pair constraint
MatchSchema.index({ user1Id: 1, user2Id: 1 }, { unique: true });

export const MatchModel =
  mongoose.models.Match || mongoose.model<IMatch>('Match', MatchSchema);
