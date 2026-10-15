import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import PDFDocument from 'pdfkit'
import { z } from 'zod'
import Attempt from '../models/Attempt.js'
import ExamAttempt from '../models/ExamAttempt.js'
import Exam from '../models/Exam.js'
import Certificate from '../models/Certificate.js'
import { authenticate } from '../middleware/auth.js'
import asyncHandler from '../middleware/asyncHandler.js'

const issueInput = z.object({
  sourceType: z.enum(['quiz', 'exam']),
  attemptId: z.string().regex(/^[a-f\d]{24}$/i),
}).strict()
const certificateIdPattern = /^QLY-[A-F\d]{24}$/

function certificateResponse(certificate) {
  return {
    certificateId: certificate.certificateId,
    downloadUrl: `/api/certificates/${certificate.certificateId}/pdf`,
    verificationUrl: `/api/certificates/verify/${certificate.certificateId}`,
  }
}

function pdfText(value) {
  return String(value).replace(/[^\x20-\x7E]/g, '?')
}

export function createCertificatesRouter({
  auth = authenticate,
  AttemptModel = Attempt,
  ExamAttemptModel = ExamAttempt,
  ExamModel = Exam,
  CertificateModel = Certificate,
  PdfDocument = PDFDocument,
  createId = () => `QLY-${randomBytes(12).toString('hex').toUpperCase()}`,
} = {}) {
  const router = Router()

  router.get('/verify/:certificateId', asyncHandler(async (req, res) => {
    if (!certificateIdPattern.test(req.params.certificateId)) {
      return res.status(404).json({ valid: false })
    }
    const certificate = await CertificateModel.findOne({ certificateId: req.params.certificateId })
      .select('certificateId learnerName title score percentage completedAt sourceType')
      .lean()
    if (!certificate) return res.status(404).json({ valid: false })
    res.json({
      valid: true,
      certificateId: certificate.certificateId,
      learnerName: certificate.learnerName,
      title: certificate.title,
      score: certificate.score,
      percentage: certificate.percentage,
      completedAt: certificate.completedAt,
      sourceType: certificate.sourceType,
      recognition: 'Quizly achievement certificate; not an accredited qualification.',
    })
  }))

  router.post('/', auth, asyncHandler(async (req, res) => {
    const input = issueInput.parse(req.body)
    const sourceType = input.sourceType
    let source
    let title
    if (sourceType === 'quiz') {
      source = await AttemptModel.findOne({ _id: input.attemptId, user: req.user._id })
        .select('quizSnapshot score percentage createdAt')
      title = source?.quizSnapshot?.title
    } else {
      source = await ExamAttemptModel.findOne({
        _id: input.attemptId,
        student: req.user._id,
        status: 'completed',
      }).select('exam status score percentage passed submittedAt')
      if (source) {
        const exam = await ExamModel.findById(source.exam).select('title').lean()
        title = exam?.title
      }
    }
    if (!source || !title) return res.status(404).json({ message: 'Completed result not found.' })
    if (sourceType === 'exam' && source.status !== 'completed') {
      return res.status(409).json({ message: 'Only completed exams can receive certificates.' })
    }
    if (sourceType === 'exam' && !source.passed) {
      return res.status(409).json({ message: 'Pass the exam to receive a certificate.' })
    }
    if (source.percentage < 80) {
      return res.status(409).json({ message: 'A score of at least 80% is required for a certificate.' })
    }
    const identity = { sourceType, sourceAttempt: source._id }
    const existing = await CertificateModel.findOne(identity)
    if (existing) return res.json(certificateResponse(existing))

    let certificate
    try {
      certificate = await CertificateModel.create({
        ...identity,
        certificateId: createId(),
        user: req.user._id,
        learnerName: req.user.name,
        title,
        score: source.score,
        percentage: source.percentage,
        completedAt: sourceType === 'exam' ? source.submittedAt : source.createdAt,
      })
    } catch (error) {
      if (error.code !== 11000) throw error
      certificate = await CertificateModel.findOne(identity)
      if (!certificate) throw error
    }
    res.status(201).json(certificateResponse(certificate))
  }))

  router.get('/:certificateId/pdf', auth, asyncHandler(async (req, res, next) => {
    if (!certificateIdPattern.test(req.params.certificateId)) {
      return res.status(404).json({ message: 'Certificate not found.' })
    }
    const certificate = await CertificateModel.findOne({ certificateId: req.params.certificateId }).lean()
    if (!certificate || (req.user.role !== 'admin' && String(certificate.user) !== String(req.user._id))) {
      return res.status(404).json({ message: 'Certificate not found.' })
    }
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="quizly-certificate-${certificate.certificateId}.pdf"`)
    const document = new PdfDocument({ size: 'A4', margin: 64, compress: true })
    document.on('error', next)
    document.pipe(res)
    document.fontSize(30).fillColor('#243b35').text('Certificate of Achievement', { align: 'center' })
    document.moveDown(1.4)
    document.fontSize(13).fillColor('#54615c').text('This certificate recognizes that', { align: 'center' })
    document.moveDown(0.6)
    document.fontSize(26).fillColor('#243b35').text(pdfText(certificate.learnerName), { align: 'center' })
    document.moveDown(0.6)
    document.fontSize(13).fillColor('#54615c').text('completed', { align: 'center' })
    document.moveDown(0.5)
    document.fontSize(20).fillColor('#243b35').text(pdfText(certificate.title), { align: 'center' })
    document.moveDown(1)
    document.fontSize(14).fillColor('#243b35').text(`Score: ${certificate.score} (${certificate.percentage}%)`, { align: 'center' })
    document.moveDown(0.5)
    document.fontSize(12).fillColor('#54615c').text(`Completion date: ${new Date(certificate.completedAt).toISOString().slice(0, 10)}`, { align: 'center' })
    document.moveDown(2)
    document.fontSize(10).text(`Certificate ID: ${certificate.certificateId}`, { align: 'center' })
    document.moveDown(0.4)
    document.text('Quizly achievement certificate; not an accredited qualification.', { align: 'center' })
    document.end()
  }))

  return router
}

export default createCertificatesRouter()
