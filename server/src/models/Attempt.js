import mongoose from 'mongoose'

const attemptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  quizSnapshot: {
    title: { type: String, required: true },
    category: { type: String, default: '' },
    difficulty: { type: String, default: '' },
    totalQuestions: { type: Number, default: 0 },
  },
  answers: [{
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedOption: { type: String, default: '' },
    questionSnapshot: {
      text: { type: String, required: true },
      options: [String],
      correctAnswer: { type: Number, required: true },
      explanation: { type: String, default: '' },
    },
  }],
  markedQuestions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  score: { type: Number, required: true, min: 0 },
  percentage: { type: Number, required: true, min: 0, max: 100 },
  correctCount: { type: Number, required: true, min: 0 },
  incorrectCount: { type: Number, required: true, min: 0 },
  unansweredCount: { type: Number, required: true, min: 0 },
  timeTaken: { type: Number, required: true, min: 0 },
  passed: { type: Boolean, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } })

export default mongoose.model('Attempt', attemptSchema)