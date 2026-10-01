import { Router } from 'express'
import User from '../models/User.js'
import Attempt from '../models/Attempt.js'
import Achievement from '../models/Achievement.js'
import { authenticate } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'
import { achievements as achievementCatalog } from './attempts.js'

const router = Router()

router.get('/profile', authenticate, asyncHandler(async (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role, createdAt: req.user.createdAt })
}))

router.get('/dashboard', authenticate, asyncHandler(async (req, res) => {
  const attempts = await Attempt.find({ user: req.user._id })
    .populate({ path: 'quiz', select: 'title difficulty category totalQuestions', populate: { path: 'category', select: 'name slug' } })
    .sort({ createdAt: -1 }).limit(250).lean()
  const count = attempts.length
  const averageScore = count ? Math.round(attempts.reduce((sum, item) => sum + item.percentage, 0) / count) : 0
  const bestScore = count ? Math.max(...attempts.map(item => item.percentage)) : 0
  const totalCorrect = attempts.reduce((sum, item) => sum + item.correctCount, 0)
  const categoryMap = new Map()
  const difficultyMap = new Map()
  for (const attempt of attempts) {
    const category = attempt.quiz?.category?.name || attempt.quizSnapshot?.category || 'Uncategorized'
    const difficulty = attempt.quiz?.difficulty || attempt.quizSnapshot?.difficulty || 'Unknown'
    const categoryRow = categoryMap.get(category) || { name: category, quizzes: 0, total: 0 }
    categoryRow.quizzes += 1
    categoryRow.total += attempt.percentage
    categoryMap.set(category, categoryRow)
    const difficultyRow = difficultyMap.get(difficulty) || { name: difficulty, quizzes: 0, total: 0 }
    difficultyRow.quizzes += 1
    difficultyRow.total += attempt.percentage
    difficultyMap.set(difficulty, difficultyRow)
  }
  const earned = await Achievement.find({ user: req.user._id }).select('code earnedAt').lean()
  const earnedMap = new Map(earned.map(item => [item.code, item.earnedAt]))
  const progressValues = {
    'first-quiz': count,
    'perfect-score': attempts.some(item => item.percentage === 100) ? 1 : 0,
    'five-quizzes': count,
    'ten-quizzes': count,
    'three-in-a-row': Math.min(count, 3),
    'category-master': Math.max(0, ...[...categoryMap.values()].filter(item => item.total / item.quizzes >= 80).map(item => item.quizzes)),
  }
  const user = await User.findById(req.user._id).select('name')
  res.json({
    name: user.name,
    stats: { quizzesCompleted: count, averageScore, bestScore, totalCorrect },
    recentAttempts: attempts.slice(0, 6).map(item => ({ ...item, quiz: item.quiz || item.quizSnapshot })),
    scoreHistory: [...attempts].reverse().slice(-12).map(item => ({ date: item.createdAt, score: item.percentage, title: item.quiz?.title || item.quizSnapshot?.title || 'Deleted quiz' })),
    categoryPerformance: [...categoryMap.values()].map(item => ({ name: item.name, score: Math.round(item.total / item.quizzes), quizzes: item.quizzes })),
    difficultyPerformance: [...difficultyMap.values()].map(item => ({ name: item.name, score: Math.round(item.total / item.quizzes), quizzes: item.quizzes })),
    achievements: achievementCatalog.map(item => ({
      ...item,
      earned: earnedMap.has(item.code),
      earnedAt: earnedMap.get(item.code) || null,
      progress: earnedMap.has(item.code) ? 100 : Math.min(100, Math.round((progressValues[item.code] / item.goal) * 100)),
    })),
  })
}))

export default router