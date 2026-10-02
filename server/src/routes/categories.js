import { Router } from 'express'
import { z } from 'zod'
import Category from '../models/Category.js'
import Quiz from '../models/Quiz.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()
const categorySchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(240).optional().default(''),
  icon: z.string().trim().max(30).optional().default('layers'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#8b7bff'),
})

router.get('/', asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ rootSlug: 1, parentSlug: 1, name: 1 }).lean()
  const counts = await Quiz.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ])
  const countById = new Map(counts.map(item => [String(item._id), item.count]))
  const countBySlug = new Map(categories.map(category => [category.slug, countById.get(String(category._id)) || 0]))
  res.json(categories.map(category => {
    const descendants = category.slug === category.rootSlug
      ? categories.filter(item => item.rootSlug === category.slug)
      : [category, ...categories.filter(item => item.parentSlug === category.slug)]
    return {
      ...category,
      quizCount: descendants.reduce((total, item) => total + (countBySlug.get(item.slug) || 0), 0),
    }
  }))
}))

router.post('/', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const input = categorySchema.parse(req.body)
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const category = await Category.create({ ...input, slug })
  res.status(201).json(category)
}))

router.put('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  const input = categorySchema.parse(req.body)
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const category = await Category.findByIdAndUpdate(req.params.id, { ...input, slug }, { new: true, runValidators: true })
  if (!category) return res.status(404).json({ message: 'Category not found.' })
  res.json(category)
}))

router.delete('/:id', authenticate, requireAdmin, asyncHandler(async (req, res) => {
  if (await Quiz.exists({ category: req.params.id })) {
    return res.status(409).json({ message: 'Move or delete quizzes in this category before removing it.' })
  }
  const category = await Category.findByIdAndDelete(req.params.id)
  if (!category) return res.status(404).json({ message: 'Category not found.' })
  res.json({ message: 'Category deleted.' })
}))

export default router