import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  slug: { type: String, required: true, lowercase: true, unique: true },
  description: { type: String, default: '' },
  icon: { type: String, default: 'layers' },
  color: { type: String, default: '#8b7bff' },
}, { timestamps: true })

export default mongoose.model('Category', categorySchema)