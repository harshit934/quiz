import { Router } from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
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
  const userIds = users.map(user => user._id)
  const performance = await Attempt.aggregate([
    { $match: { user: { $in: userIds } } },
    { $group: { _id: '$user', attempts: { $sum: 1 }, averageScore: { $avg: '$percentage' } } },
  ])
  const performanceByUser = new Map(performance.map(item => [String(item._id), item]))
  res.json(users.map(user => {
    const stats = performanceByUser.get(String(user._id))
    return { ...user, attempts: stats?.attempts || 0, averageScore: Math.round(stats?.averageScore || 0) }
  }))
}))

router.get('/stats/quizzes', asyncHandler(async (req, res) => {
  const [quizzes, performance] = await Promise.all([
    Quiz.find().select('title category difficulty').populate('category', 'name').sort({ title: 1 }).lean(),
    Attempt.aggregate([
      { $group: { _id: '$quiz', attempts: { $sum: 1 }, users: { $addToSet: '$user' }, averageScore: { $avg: '$percentage' } } },
    ]),
  ])
  const performanceByQuiz = new Map(performance.map(item => [String(item._id), item]))
  res.json(quizzes.map(quiz => {
    const stats = performanceByQuiz.get(String(quiz._id))
    return {
      _id: quiz._id,
      title: quiz.title,
      category: quiz.category?.name || 'Uncategorized',
      difficulty: quiz.difficulty,
      attempts: stats?.attempts || 0,
      learners: stats?.users.length || 0,
      averageScore: Math.round(stats?.averageScore || 0),
    }
  }))
}))

router.patch('/users/:id/role', asyncHandler(async (req, res) => {
  const input = z.object({ role: z.enum(['user', 'admin']) }).parse(req.body)
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'User not found.' })
  const user = await User.findById(req.params.id)
  if (!user) return res.status(404).json({ message: 'User not found.' })
  if (String(user._id) === String(req.user._id) && input.role !== 'admin') {
    return res.status(409).json({ message: 'You cannot remove your own administrator access.' })
  }
  if (user.role === 'admin' && input.role === 'user' && await User.countDocuments({ role: 'admin' }) < 2) {
    return res.status(409).json({ message: 'At least one administrator account must remain.' })
  }
  user.role = input.role
  await user.save()
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })
}))

export default router