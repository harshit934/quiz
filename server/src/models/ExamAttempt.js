import mongoose from 'mongoose'

const examAttemptAnswerSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  selectedOption: { type: String, default: '' },
  markedForReview: { type: Boolean, default: false },
}, { _id: false })

const examAttemptQuestionSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  text: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswer: { type: Number, required: true, min: 0, max: 3 },
  explanation: { type: String, default: '' },
}, { _id: false })

const examAttemptSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  attemptNumber: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['in-progress', 'completed', 'expired'], default: 'in-progress', index: true },
  answers: { type: [examAttemptAnswerSchema], default: [] },
  questionSnapshots: { type: [examAttemptQuestionSchema], required: true },
  score: { type: Number, default: 0, min: 0 },
  totalMarks: { type: Number, required: true, min: 1 },
  percentage: { type: Number, default: 0, min: 0, max: 100 },
  correctAnswers: { type: Number, default: 0, min: 0 },
  wrongAnswers: { type: Number, default: 0, min: 0 },
  unanswered: { type: Number, default: 0, min: 0 },
  passed: { type: Boolean, default: false },
  startedAt: { type: Date, required: true, default: Date.now },
  submittedAt: { type: Date, default: null },
  timeTaken: { type: Number, default: 0, min: 0 },
}, { timestamps: { createdAt: true, updatedAt: true } })

examAttemptSchema.index({ exam: 1, student: 1, attemptNumber: 1 }, { unique: true })

export default mongoose.model('ExamAttempt', examAttemptSchema)
