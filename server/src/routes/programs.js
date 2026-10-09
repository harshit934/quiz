import { Router } from 'express'
import SavedProgram from '../models/SavedProgram.js'
import { authenticate } from '../middleware/auth.js'
import { compilerLanguageIds } from '../../../shared/playgroundLanguages.js'

const languages = new Set(['javascript', 'python', 'html', 'css', 'react', 'sql', 'mongodb', 'node-js', 'cloud-computing', ...Object.keys(compilerLanguageIds)])
const serialize = program => ({ id: program.id, name: program.name, language: program.language, code: program.code, input: program.input, revision: program.revision, updatedAt: program.updatedAt })

export function createProgramsRouter(Model = SavedProgram, auth = authenticate) {
  const router = Router()
  router.use(auth)
  const wrap = handler => async (req, res, next) => {
    try { await handler(req, res) } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'This name or program already exists. Refresh the library before saving again.' })
      next(error)
    }
  }
  router.get('/', wrap(async (req, res) => {
    const programs = await Model.find({ user: req.user._id }).sort({ updatedAt: -1 }).lean()
    res.json({ programs: programs.map(serialize) })
  }))
  router.put('/:id', wrap(async (req, res) => {
    const { name, language, code, input, revision } = req.body || {}
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(req.params.id) || typeof name !== 'string' || !name.trim() || name.trim().length > 80 || !languages.has(language) || typeof code !== 'string' || code.length > 100000 || typeof input !== 'string' || input.length > 50000 || !Number.isSafeInteger(revision) || revision < 0) return res.status(400).json({ message: 'Check the program name, language, code size and revision.' })
    const fields = { name: name.trim(), nameKey: name.trim().toLowerCase(), language, code, input }
    let program
    if (revision === 0) program = await Model.create({ ...fields, user: req.user._id, id: req.params.id, revision: 1 })
    else program = await Model.findOneAndUpdate({ user: req.user._id, id: req.params.id, revision }, { $set: fields, $inc: { revision: 1 } }, { new: true, runValidators: true })
    if (!program) return res.status(409).json({ message: 'This program changed on another device or was deleted. Reopen its latest version before saving. Your browser copy is kept.' })
    res.json({ program: serialize(program) })
  }))
  router.delete('/:id', wrap(async (req, res) => {
    const revision = req.body?.revision
    if (!Number.isSafeInteger(revision) || revision < 1) return res.status(400).json({ message: 'A saved program revision is required.' })
    const program = await Model.findOneAndDelete({ user: req.user._id, id: req.params.id, revision })
    if (!program) return res.status(409).json({ message: 'This program changed on another device or was deleted. Refresh the library before deleting.' })
    res.json({ deleted: true })
  }))
  return router
}
export default createProgramsRouter()
