import { Router } from 'express'
import User from '../models/User.js'
import Attempt from '../models/Attempt.js'
import Achievement from '../models/Achievement.js'
import { authenticate } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'
import { achievements as achievementCatalog } from './attempts.js'
import Quiz from '../models/Quiz.js'
import { recommendQuizzes } from '../recommendations.js'
import QuizReward from '../models/QuizReward.js'
import { summarizeGamification } from '../gamification.js'
import Category from '../models/Category.js'
import { summarizeWeakAreas } from '../weakAreas.js'

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

router.get('/recommendations', authenticate, asyncHandler(async (req, res) => {
  const [attempts, quizzes] = await Promise.all([
    Attempt.find({ user: req.user._id })
      .select('percentage quiz')
      .sort({ createdAt: -1 })
      .limit(30)
      .populate({ path: 'quiz', select: 'category', populate: { path: 'category', select: 'name slug parentSlug rootSlug' } })
      .lean(),
    Quiz.find({ isPrivate: { $ne: true } }).select('title description difficulty totalQuestions timeLimit category featured')
      .populate('category', 'name slug parentSlug rootSlug')
      .sort({ featured: -1, title: 1 }).limit(300).lean(),
  ])
  res.json({ recommendations: recommendQuizzes(attempts, quizzes) })
}))

router.get('/weak-areas', authenticate, asyncHandler(async (req, res) => {
  const attempts = await Attempt.find({ user: req.user._id })
    .select('percentage quiz quizSnapshot answers')
    .sort({ createdAt: -1 })
    .limit(250)
    .populate({ path: 'quiz', select: 'category', populate: { path: 'category', select: 'name slug parentSlug rootSlug' } })
    .lean()
  const categoryIds = [...new Set(attempts.flatMap(attempt => [
    attempt.quiz?.category?._id,
    ...(attempt.answers || []).map(answer => answer.questionSnapshot?.categoryId),
  ]).filter(Boolean).map(String))]
  const categories = await Category.find({ _id: { $in: categoryIds } }).select('name slug parentSlug rootSlug').lean()
  const rootSlugs = [...new Set(categories.map(category => category.rootSlug || category.slug))]
  const [rootCategories, quizzes] = await Promise.all([
    Category.find({ slug: { $in: rootSlugs } }).select('name slug').lean(),
    Quiz.find({ category: { $in: categoryIds }, isPrivate: { $ne: true } })
      .select('title category featured attemptsCount')
      .sort({ featured: -1, attemptsCount: -1, title: 1 })
      .lean(),
  ])
  const areas = summarizeWeakAreas(attempts, [...categories, ...rootCategories], quizzes)
  res.json({ areas, weakAreas: areas.filter(area => area.average < 70) })
}))

router.get('/gamification', authenticate, asyncHandler(async (req, res) => {
  const yearAgo = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000)
  const [rewards, attempts] = await Promise.all([
    QuizReward.find({ user: req.user._id }).select('xp').lean(),
    Attempt.find({ user: req.user._id, createdAt: { $gte: yearAgo } }).select('createdAt quiz').sort({ createdAt: -1 }).lean(),
  ])
  res.json(summarizeGamification(rewards, attempts))
}))

export default router