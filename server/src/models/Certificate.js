import mongoose from 'mongoose'

const certificateSchema = new mongoose.Schema({
  certificateId: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sourceType: { type: String, enum: ['quiz', 'exam'], required: true },
  sourceAttempt: { type: mongoose.Schema.Types.ObjectId, required: true },
  learnerName: { type: String, required: true },
  title: { type: String, required: true },
  score: { type: Number, required: true, min: 0 },
  percentage: { type: Number, required: true, min: 80, max: 100 },
  completedAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } })

certificateSchema.index({ sourceType: 1, sourceAttempt: 1 }, { unique: true })

export default mongoose.model('Certificate', certificateSchema)
