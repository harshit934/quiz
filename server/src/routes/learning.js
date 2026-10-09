import { Router } from 'express'
import { z } from 'zod'
import LearningState from '../models/LearningState.js'
import { authenticate } from '../middleware/auth.js'
import { emptyLearning, applyLearningOperation } from '../../../shared/learningState.js'

const text = z.string().max(100000)
const challenge = z.object({ id: z.string().min(1).max(150), subjectId: z.string().max(80), difficulty: z.enum(['Easy', 'Medium', 'Hard']), testCases: z.array(z.record(z.unknown())).min(1).max(10) }).passthrough()
const results = z.array(z.object({ name: z.string().max(150), passed: z.boolean(), actual: z.unknown().optional(), error: z.string().max(8000).optional() })).max(10)
const progress = z.object({ subjectId: z.string().max(80), difficulty: z.enum(['Easy', 'Medium', 'Hard']), total: z.number().int().min(1).max(10), passed: z.number().int().min(0).max(10), score: z.number().min(0).max(100), status: z.string().max(40), tested: z.boolean().optional() })
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const question = z.object({ text: z.string().max(1000), options: z.array(z.string().max(500)).min(2).max(10), correctAnswer: z.number().int().min(0).max(9), explanation: z.string().max(2000).optional() })
const operation = z.object({ id: z.string().min(1).max(100), type: z.enum(['goal', 'bookmark', 'coding', 'quiz', 'review', 'import']), data: z.unknown() })
const dataSchemas = {
  goal: z.object({ goal: z.number().int().min(1).max(50) }),
  bookmark: z.object({ key: z.string().min(1).max(200), remove: z.boolean().optional(), item: z.object({ kind: z.enum(['coding', 'quiz']), title: z.string().max(200), quizId: z.string().max(100).optional(), challenge: challenge.optional() }).optional() }).refine(data => data.remove || data.item),
  coding: z.object({ challenge, code: text, results, progress, day }),
  quiz: z.object({ attemptId: z.string().min(1).max(150), day, rows: z.array(z.object({ id: z.string().max(1500), title: z.string().max(200), question, selectedOption: z.string().max(500), resolved: z.boolean() })).max(100) }),
  review: z.object({ key: z.string().max(1500) }),
  import: z.object({ progress: z.record(progress).optional(), mistakes: z.array(z.object({ challenge, code: text, results, resolved: z.boolean(), updatedAt: z.number() })).max(50).optional() }),
}
export function validateLearningOperation(body) {
  const op = operation.parse(body)
  op.data = dataSchemas[op.type].parse(op.data)
  if (JSON.stringify(op).length > 500000) throw Object.assign(new Error('Practice update is too large.'), { status: 413 })
  return op
}
export function createLearningRouter(Model = LearningState, auth = authenticate) {
  const router = Router(); router.use(auth)
  const wrap = handler => async (req, res, next) => { try { await handler(req, res) } catch (error) { next(error) } }
  router.get('/', wrap(async (req, res) => { const row = await Model.findOne({ user: req.user._id }); res.json({ state: row?.state || emptyLearning() }) }))
  router.post('/', wrap(async (req, res) => {
    const ops = req.body?.operations ? z.array(z.unknown()).min(1).max(20).parse(req.body.operations).map(validateLearningOperation) : [validateLearningOperation(req.body)]
    for (let retry = 0; retry < 8; retry++) {
      const row = await Model.findOne({ user: req.user._id })
      const state = ops.reduce(applyLearningOperation, row?.state || emptyLearning())
      if (JSON.stringify(state).length > 8000000) return res.status(413).json({ message: 'Practice history is too large to sync.' })
      if (!row) {
        try { await Model.create({ user: req.user._id, state, revision: 1 }); return res.json({ state }) }
        catch (error) { if (error.code === 11000) continue; throw error }
      }
      const updated = await Model.findOneAndUpdate({ user: req.user._id, revision: row.revision }, { $set: { state }, $inc: { revision: 1 } }, { new: true })
      if (updated) return res.json({ state: updated.state })
    }
    res.status(409).json({ message: 'Practice is busy syncing. Retry in a moment; your browser copy is kept.' })
  }))
  return router
}
export default createLearningRouter()
