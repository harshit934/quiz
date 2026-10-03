import mongoose from 'mongoose'

const examRegistrationSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  registeredAt: { type: Date, default: Date.now },
}, { timestamps: false })

examRegistrationSchema.index({ exam: 1, student: 1 }, { unique: true })

export default mongoose.model('ExamRegistration', examRegistrationSchema)
