import { Router } from 'express'
import mongoose from 'mongoose'
import Attempt from '../models/Attempt.js'
import Quiz from '../models/Quiz.js'
import Category from '../models/Category.js'
import { optionalAuthenticate } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()
const publicName = name => {
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0]
}

router.get('/', optionalAuthenticate, asyncHandler(async (req, res) => {
  const filter = {}
  if (req.query.category) {
    const category = mongoose.isValidObjectId(req.query.category)
      ? await Category.findById(req.query.category).select('_id')
      : await Category.findOne({ slug: req.query.category }).select('_id')
    if (!category) return res.json([])
    const quizzes = await Quiz.find({ category: category._id }).select('_id')
    filter.quiz = { $in: quizzes.map(quiz => quiz._id) }
  }
  const attempts = await Attempt.find(filter)
    .sort({ percentage: -1, score: -1, createdAt: 1 }).limit(100)
    .populate('user', 'name')
    .populate({ path: 'quiz', select: 'title category', populate: { path: 'category', select: 'name slug' } })
    .lean()
  res.json(attempts.filter(item => item.user && (item.quiz || item.quizSnapshot)).map((item, index) => ({
    rank: index + 1,
    name: publicName(item.user.name),
    score: item.score,
    percentage: item.percentage,
    quiz: item.quiz?.title || item.quizSnapshot.title,
    category: item.quiz?.category?.name || item.quizSnapshot.category || 'General',
    date: item.createdAt,
    currentUser: Boolean(req.user && String(item.user._id) === String(req.user._id)),
  })))
}))

export default router