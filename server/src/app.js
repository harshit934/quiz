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
import codingRoutes from './routes/coding.js'
import learningRoutes from './routes/learning.js'

import User from './models/User.js'
import Quiz from './models/Quiz.js'
import Question from './models/Question.js'
import Category from './models/Category.js'

import {
  notFound,
  errorHandler,
} from './middleware/errors.js'

const app = express()

app.disable('x-powered-by')

app.use(helmet())

/*
 * CORS
 *
 * Allows:
 * - Your Netlify frontend
 * - Local Vite development
 * - Additional URLs provided through CLIENT_URL
 * - Netlify preview/deployment URLs
 */
const configuredOrigins = (
  process.env.CLIENT_URL ||
  ''
)
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://quizly-frontend.onrender.com',
  ...configuredOrigins,
]

app.use(
  cors({
    origin: (origin, callback) => {
      /*
       * Requests without an Origin header can happen
       * from tools such as curl, Postman, Render health
       * checks, etc.
       */
      if (!origin) {
        return callback(null, true)
      }

      /*
       * Allow explicitly configured frontend URLs.
       */
      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      /*
       * Allow Netlify deployment/preview URLs.
       *
       * Example:
       * https://quizly.netlify.app
       */
      if (
        origin.endsWith('.netlify.app')
      ) {
        return callback(null, true)
      }

      /*
       * Reject unknown browser origins.
       */
      return callback(
        new Error(
          `CORS blocked request from origin: ${origin}`
        )
      )
    },

    credentials: true,
  })
)

app.use(
  express.json({
    limit: '1mb',
  })
)

/*
 * Health check
 *
 * This endpoint does not require MongoDB.
 * It lets Render/browser checks confirm that
 * the Node server itself is alive.
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',

    database:
      mongoose.connection.readyState === 1
        ? 'connected'
        : 'disconnected',
  })
})

/*
 * Database protection
 *
 * All other /api routes require an active
 * MongoDB connection.
 */
app.use('/api/coding', codingRoutes)
app.use('/api/learning', learningRoutes)

app.use('/api', (req, res, next) => {
  if (
    mongoose.connection.readyState !== 1
  ) {
    return res.status(503).json({
      message:
        'The database is not connected. Check MONGODB_URI and restart the API.',
    })
  }

  next()
})

/*
 * Public statistics
 */
app.get(
  '/api/stats',
  async (req, res, next) => {
    try {
      const [
        users,
        quizzes,
        questions,
        categories,
      ] = await Promise.all([
        User.countDocuments(),
        Quiz.countDocuments(),
        Question.countDocuments(),
        Category.countDocuments(),
      ])

      res.json({
        users,
        quizzes,
        questions,
        categories,
      })
    } catch (error) {
      next(error)
    }
  }
)

/*
 * Authentication rate limit
 */
app.use(
  '/api/auth',
  rateLimit({
    windowMs:
      15 * 60 * 1000,

    limit: 30,

    standardHeaders: 'draft-7',

    legacyHeaders: false,
  })
)

/*
 * API routes
 */
app.use(
  '/api/auth',
  authRoutes
)

app.use(
  '/api/users',
  userRoutes
)

app.use(
  '/api/quizzes',
  quizRoutes
)

app.use(
  '/api/categories',
  categoryRoutes
)

app.use(
  '/api/attempts',
  attemptRoutes
)

app.use(
  '/api/exams',
  examRoutes
)

app.use(
  '/api/leaderboard',
  leaderboardRoutes
)

app.use(
  '/api/admin',
  adminRoutes
)

/*
 * 404 handler
 */
app.use(notFound)

/*
 * Global error handler
 */
app.use(errorHandler)

export default app
