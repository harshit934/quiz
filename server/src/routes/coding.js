import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth.js'
import { runCompiler, validCompilerRequest } from '../services/compiler.js'

const router = Router()
router.get('/status', (req, res) => res.json({ configured: Boolean(process.env.JUDGE0_URL) }))
router.post('/run', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }), (req, res, next) => {
  if (!process.env.JUDGE0_URL) return res.status(503).json({ message: 'Compiler service is not configured. Set JUDGE0_URL on the API server to enable Java, Node.js and Bash.' })
  next()
}, authenticate, async (req, res, next) => {
  if (!validCompilerRequest(req.body)) return res.status(400).json({ message: 'Invalid runtime, code or test cases.' })
  try { res.json({ results: await runCompiler(req.body) }) }
  catch (error) { res.status(error.status || 502).json({ message: error.message }) }
})
export default router
