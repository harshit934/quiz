import mongoose from 'mongoose'

const bookmarkSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
}, { timestamps: { createdAt: true, updatedAt: false } })

bookmarkSchema.index({ user: 1, question: 1 }, { unique: true })

export default mongoose.model('Bookmark', bookmarkSchema)
