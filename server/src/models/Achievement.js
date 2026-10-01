import mongoose from 'mongoose'

const achievementSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  code: { type: String, required: true },
  earnedAt: { type: Date, default: Date.now },
  progress: { type: Number, default: 100, min: 0, max: 100 },
})
achievementSchema.index({ user: 1, code: 1 }, { unique: true })

export default mongoose.model('Achievement', achievementSchema)