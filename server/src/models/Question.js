import mongoose from 'mongoose'

const questionSchema = new mongoose.Schema({
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
  text: { type: String, required: true, trim: true, maxlength: 500 },
  options: {
    type: [{ type: String, required: true, trim: true, maxlength: 180 }],
    validate: [options => options.length === 4 && new Set(options.map(option => option.toLocaleLowerCase())).size === 4, 'Each question must have four unique options'],
  },
  correctAnswer: { type: Number, required: true, min: 0, max: 3 },
  explanation: { type: String, default: '', maxlength: 500 },
  position: { type: Number, default: 0 },
})

export default mongoose.model('Question', questionSchema)