import mongoose from 'mongoose'

const examQuestionSchema = new mongoose.Schema({
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  text: { type: String, required: true },
  options: { type: [String], required: true },
  correctAnswer: { type: Number, required: true, min: 0, max: 3 },
  explanation: { type: String, default: '' },
  sourceDifficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
}, { _id: false })

const examSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: '', maxlength: 1000 },
  instructions: { type: String, default: '', maxlength: 5000 },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
  topics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard', 'Mixed'], required: true },
  questionCount: { type: Number, required: true, min: 1, max: 200 },
  duration: { type: Number, required: true, min: 1, max: 600 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  passingPercentage: { type: Number, required: true, min: 0, max: 100 },
  maxAttempts: { type: Number, required: true, min: 1, max: 20 },
  status: { type: String, enum: ['draft', 'scheduled', 'published', 'live', 'completed', 'cancelled'], default: 'draft', index: true },
  selectionMethod: { type: String, enum: ['manual', 'random'], required: true },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
  questionSnapshots: { type: [examQuestionSchema], required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

export default mongoose.model('Exam', examSchema)
