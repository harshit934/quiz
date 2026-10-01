import { Router } from 'express'
import User from '../models/User.js'
import Quiz from '../models/Quiz.js'
import Question from '../models/Question.js'
import Attempt from '../models/Attempt.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
router.use(authenticate, requireAdmin)

router.get('/stats', asyncHandler(async (req, res) => {
  const [users, quizzes, questions, attempts, performance, recentAttempts] = await Promise.all([
    User.countDocuments(),
    Quiz.countDocuments(),
    Question.countDocuments(),
    Attempt.countDocuments(),
    Attempt.aggregate([{ $group: { _id: null, average: { $avg: '$percentage' } } }]),
    Attempt.find().sort({ createdAt: -1 }).limit(8)
      .populate('user', 'name')
      .populate({ path: 'quiz', select: 'title category', populate: { path: 'category', select: 'name' } })
      .lean(),
  ])
  res.json({
    users,
    quizzes,
    questions,
    attempts,
    averageScore: Math.round(performance[0]?.average || 0),
    recentAttempts: recentAttempts.filter(item => item.user && item.quiz).map(item => ({
      user: item.user.name,
      quiz: item.quiz.title,
      category: item.quiz.category?.name,
      score: item.score,
      percentage: item.percentage,
      createdAt: item.createdAt,
    })),
  })
}))

router.get('/users', asyncHandler(async (req, res) => {
  const search = String(req.query.search || '').slice(0, 80)
  const safeSearch = escapeRegex(search)
  const filter = search ? { $or: [
    { name: { $regex: safeSearch, $options: 'i' } },
    { email: { $regex: safeSearch, $options: 'i' } },
  ] } : {}
  const users = await User.find(filter).select('name email role createdAt').sort({ createdAt: -1 }).limit(100).lean()
  res.json(users)
}))

export default router