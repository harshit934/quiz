import mongoose from 'mongoose'

const quizRewardSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  rewardKey: { type: String, required: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', default: null },
  attempt: { type: mongoose.Schema.Types.ObjectId, ref: 'Attempt', required: true },
  type: { type: String, enum: ['quiz', 'daily-challenge', 'weekly-challenge'], required: true },
  xp: { type: Number, required: true, min: 1 },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  awardedAt: { type: Date, default: Date.now },
})

quizRewardSchema.index({ user: 1, rewardKey: 1 }, { unique: true })

export default mongoose.model('QuizReward', quizRewardSchema)
