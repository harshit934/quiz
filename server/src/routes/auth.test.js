import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import test from 'node:test'
import authRoutes from './auth.js'

test('Google sign-in fails explicitly when its client ID is not configured', async () => {
  const previousClientId = process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_ID

  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRoutes)
  app.use((error, req, res, next) => {
    res.status(error.status || 500).json({ message: error.message })
  })

  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const url = `http://127.0.0.1:${server.address().port}/api/auth/google`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: 'google-id-token' }),
    })

    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      message: 'Google sign-in is not configured on this server.',
    })
  } finally {
    const closed = once(server, 'close')
    server.close()
    await closed
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = previousClientId
  }
})
