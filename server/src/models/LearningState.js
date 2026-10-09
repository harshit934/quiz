import mongoose from 'mongoose'
const schema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, state: { type: mongoose.Schema.Types.Mixed, required: true }, revision: { type: Number, default: 0 } }, { timestamps: true })
export default mongoose.model('LearningState', schema)
