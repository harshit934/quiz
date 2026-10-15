import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import test from 'node:test'
import { createCertificatesRouter } from './certificates.js'

test('certificates require verified eligible owned attempts and can be downloaded and verified', async () => {
  const quizAttemptId = '507f1f77bcf86cd799439031'
  const examAttemptId = '507f1f77bcf86cd799439032'
  const certificates = new Map()
  const quizAttempts = new Map([
    [quizAttemptId, { _id: quizAttemptId, user: 'alice', quizSnapshot: { title: 'Science basics' }, score: 8, percentage: 80, createdAt: new Date('2026-10-10T12:00:00Z') }],
    ['507f1f77bcf86cd799439033', { _id: '507f1f77bcf86cd799439033', user: 'alice', quizSnapshot: { title: 'Below threshold' }, score: 7, percentage: 70, createdAt: new Date() }],
  ])
  const examAttempts = new Map([
    [examAttemptId, { _id: examAttemptId, student: 'alice', exam: 'exam-1', status: 'completed', passed: true, score: 9, percentage: 90, submittedAt: new Date('2026-10-11T12:00:00Z') }],
  ])
  const query = value => Object.assign(Promise.resolve(value), {
    select() { return this },
    lean: async () => value,
  })
  const CertificateModel = {
    findOne: filter => {
      const value = filter.certificateId
        ? certificates.get(filter.certificateId)
        : [...certificates.values()].find(item => item.sourceType === filter.sourceType && item.sourceAttempt === filter.sourceAttempt)
      return query(value)
    },
    create: async input => {
      const certificate = { ...input, _id: `cert-${certificates.size}` }
      certificates.set(input.certificateId, certificate)
      return certificate
    },
  }
  const AttemptModel = {
    findOne: filter => query(quizAttempts.get(filter._id)?.user === filter.user ? quizAttempts.get(filter._id) : null),
  }
  const ExamAttemptModel = {
    findOne: filter => query(examAttempts.get(filter._id)?.student === filter.student && examAttempts.get(filter._id)?.status === filter.status ? examAttempts.get(filter._id) : null),
  }
  const ExamModel = { findById: () => query({ title: 'Final exam' }) }
  const auth = (req, res, next) => {
    const user = req.headers['x-test-user']
    if (!user) return res.status(401).json({ message: 'Sign in.' })
    req.user = { _id: user, name: user === 'alice' ? 'Alice Learner' : 'Bob', role: 'user' }
    next()
  }
  const app = express()
  app.use(express.json())
  let sequence = 1
  app.use('/certificates', createCertificatesRouter({
    auth,
    CertificateModel,
    AttemptModel,
    ExamAttemptModel,
    ExamModel,
    createId: () => `QLY-${String(sequence++).padStart(24, '0')}`,
  }))
  app.use((error, req, res, next) => res.status(error.status || 500).json({ message: error.message }))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const base = `http://127.0.0.1:${server.address().port}/certificates`
  const issue = (user, body) => fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(user ? { 'x-test-user': user } : {}) },
    body: JSON.stringify(body),
  })

  try {
    assert.equal((await issue(null, { sourceType: 'quiz', attemptId: quizAttemptId })).status, 401)
    assert.equal((await issue('bob', { sourceType: 'quiz', attemptId: quizAttemptId })).status, 404)
    assert.equal((await issue('alice', { sourceType: 'quiz', attemptId: '507f1f77bcf86cd799439033' })).status, 409)

    const response = await issue('alice', { sourceType: 'quiz', attemptId: quizAttemptId })
    assert.equal(response.status, 201)
    const result = await response.json()
    assert.equal(result.certificateId, 'QLY-000000000000000000000001')
    assert.equal((await issue('alice', { sourceType: 'quiz', attemptId: quizAttemptId })).status, 200)

    const verification = await fetch(`${base}/verify/${result.certificateId}`)
    const verified = await verification.json()
    assert.equal(verified.valid, true)
    assert.equal(verified.learnerName, 'Alice Learner')
    assert.equal('user' in verified, false)
    assert.match(verified.recognition, /not an accredited qualification/)

    const foreignDownload = await fetch(`${base}/${result.certificateId}/pdf`, { headers: { 'x-test-user': 'bob' } })
    assert.equal(foreignDownload.status, 404)
    const download = await fetch(`${base}/${result.certificateId}/pdf`, { headers: { 'x-test-user': 'alice' } })
    assert.equal(download.status, 200)
    assert.match(download.headers.get('content-type'), /application\/pdf/)
    assert.equal(Buffer.from(await download.arrayBuffer()).subarray(0, 5).toString(), '%PDF-')

    const exam = await issue('alice', { sourceType: 'exam', attemptId: examAttemptId })
    assert.equal(exam.status, 201)
    assert.equal((await exam.json()).certificateId, 'QLY-000000000000000000000002')
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
