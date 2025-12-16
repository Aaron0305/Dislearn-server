import mongoose from 'mongoose';

const ExerciseAttemptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['reading', 'writing', 'comprehension'],
      index: true,
    },
    exerciseType: {
      type: String,
      required: true,
      index: true,
    },
    exerciseId: {
      type: String,
      default: null,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
    },
    maxScore: {
      type: Number,
      required: true,
      min: 1,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

ExerciseAttemptSchema.index({ userId: 1, createdAt: -1 });
ExerciseAttemptSchema.index({ userId: 1, category: 1, createdAt: -1 });

export default mongoose.model('ExerciseAttempt', ExerciseAttemptSchema);
