import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoose from 'mongoose'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import quizRoutes from './routes/quizzes.js'
import categoryRoutes from './routes/categories.js'
import attemptRoutes from './routes/attempts.js'
import examRoutes from './routes/exams.js'
import leaderboardRoutes from './routes/leaderboard.js'
import adminRoutes from './routes/admin.js'
import User from './models/User.js'
import Quiz from './models/Quiz.js'
import Question from './models/Question.js'
import Category from './models/Category.js'
import { notFound, errorHandler } from './middleware/errors.js'

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map(value => value.trim()) }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (req, res) => res.json({
  status: 'ok',
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
}))
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'The database is not connected. Check MONGODB_URI and restart the API.' })
  }
  next()
})
app.get('/api/stats', async (req, res, next) => {
  try {
    const [users, quizzes, questions, categories] = await Promise.all([
      User.countDocuments(), Quiz.countDocuments(), Question.countDocuments(), Category.countDocuments(),
    ])
    res.json({ users, quizzes, questions, categories })
  } catch (error) {
    next(error)
  }
})
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }))
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/quizzes', quizRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/attempts', attemptRoutes)
app.use('/api/exams', examRoutes)
app.use('/api/leaderboard', leaderboardRoutes)
app.use('/api/admin', adminRoutes)
app.use(notFound)
app.use(errorHandler)

export default app