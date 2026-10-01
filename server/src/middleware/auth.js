import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export async function authenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null
  if (!token) return res.status(401).json({ message: 'Sign in to continue.' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.sub).select('name email role createdAt')
    if (!user) return res.status(401).json({ message: 'Your account is no longer available.' })
    req.user = user
    next()
  } catch {
    res.status(401).json({ message: 'Your session has expired. Please sign in again.' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access required.' })
  next()
}

export async function optionalAuthenticate(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null
  if (token) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      req.user = await User.findById(payload.sub).select('name email role createdAt') || undefined
    } catch {
      req.user = undefined
    }
  }
  next()
}