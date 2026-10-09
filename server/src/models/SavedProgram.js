import mongoose from 'mongoose'

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  id: { type: String, required: true, maxlength: 100 },
  name: { type: String, required: true, maxlength: 80 },
  nameKey: { type: String, required: true },
  language: { type: String, required: true },
  code: { type: String, default: '', maxlength: 100000 },
  input: { type: String, default: '', maxlength: 50000 },
  revision: { type: Number, required: true, default: 1 },
}, { timestamps: true })
schema.index({ user: 1, id: 1 }, { unique: true })
schema.index({ user: 1, language: 1, nameKey: 1 }, { unique: true })
export default mongoose.model('SavedProgram', schema)
