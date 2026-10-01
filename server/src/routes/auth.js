import { Router } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()
const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(100),
})

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    const error = new Error('Authentication is not configured on this server.')
    error.status = 503
    throw error
  }
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

router.post('/register', asyncHandler(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(60),
    ...credentialsSchema.shape,
  }).parse(req.body)
  const user = await User.create(input)
  res.status(201).json({ token: createToken(user), user: publicUser(user) })
}))

router.post('/login', asyncHandler(async (req, res) => {
  const input = credentialsSchema.parse(req.body)
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+password')
  if (!user || !(await user.comparePassword(input.password))) {
    return res.status(401).json({ message: 'Email or password is incorrect.' })
  }
  res.json({ token: createToken(user), user: publicUser(user) })
}))

export default router