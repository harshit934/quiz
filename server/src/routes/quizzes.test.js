import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import test from 'node:test'
import quizRoutes from './quizzes.js'

test('quiz submission requires authentication', async () => {
  const app = express()
  app.use(express.json())
  app.use('/api/quizzes', quizRoutes)

  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/quizzes`

  try {
    const response = await fetch(
      `${baseUrl}/507f1f77bcf86cd799439011/submit`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          answers: [{ questionId: 'q1', selectedOption: 'B' }],
          markedQuestionIds: [],
          timeTaken: 0,
        }),
      }
    )

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { message: 'Sign in to continue.' })
  } finally {
    const closed = once(server, 'close')
    server.close()
    await closed
  }
})
