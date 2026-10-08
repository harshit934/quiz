import { Router } from 'express'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import User from '../models/User.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()
const googleClient = new OAuth2Client()
const googleCredentialSchema = z.object({
  credential: z.string().min(1).max(10000),
})
const registrationCredentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(100),
})
const loginCredentialsSchema = z.object({
  identifier: z.string().trim().min(3).max(254).optional(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(8).max(100),
}).refine(input => input.identifier || input.email, { path: ['identifier'], message: 'Enter your email or username.' })

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
    ...registrationCredentialsSchema.shape,
  }).parse(req.body)
  const user = await User.create(input)
  res.status(201).json({ token: createToken(user), user: publicUser(user) })
}))

router.post('/login', asyncHandler(async (req, res) => {
  const input = loginCredentialsSchema.parse(req.body)
  const identity = (input.identifier || input.email).toLowerCase()
  const lookup = identity.includes('@') ? { email: identity } : { username: identity }
  const user = await User.findOne(lookup).select('+password')
  if (!user || !(await user.comparePassword(input.password))) {
    return res.status(401).json({ message: 'Email, username, or password is incorrect.' })
  }
  res.json({ token: createToken(user), user: publicUser(user) })
}))

router.post('/google', asyncHandler(async (req, res) => {
  const { credential } = googleCredentialSchema.parse(req.body)
  if (!process.env.GOOGLE_CLIENT_ID) {
    const error = new Error('Google sign-in is not configured on this server.')
    error.status = 503
    throw error
  }

  let ticket
  try {
    ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    })
  } catch {
    return res.status(401).json({ message: 'Google sign-in could not be verified.' })
  }

  const profile = ticket.getPayload()
  if (!profile?.sub || !profile.email || profile.email_verified !== true) {
    return res.status(401).json({ message: 'Google must provide a verified email address.' })
  }

  const email = profile.email.toLowerCase()
  let user = await User.findOne({ googleId: profile.sub })
  if (!user) {
    user = await User.findOne({ email })
    if (user) {
      user.googleId = profile.sub
      await user.save()
    } else {
      user = await User.create({
        name: profile.name || email.split('@')[0],
        email,
        googleId: profile.sub,
        password: randomBytes(32).toString('base64url'),
      })
    }
  }

  res.json({ token: createToken(user), user: publicUser(user) })
}))

export default router