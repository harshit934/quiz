import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createProgramsRouter } from './programs.js'

test('cloud programs isolate accounts, persist CRUD and reject stale writes', async () => {
  const rows = []
  const match = (row, filter) => Object.entries(filter).every(([key, value]) => row[key] === value)
  const Model = {
    find: filter => ({ sort: () => ({ lean: async () => rows.filter(row => match(row, filter)) }) }),
    create: async row => { if (rows.some(item => item.user === row.user && (item.id === row.id || (item.language === row.language && item.nameKey === row.nameKey)))) throw Object.assign(new Error('duplicate'), { code: 11000 }); rows.push(row); return row },
    findOneAndUpdate: async (filter, update) => { const row = rows.find(item => match(item, filter)); if (!row) return null; Object.assign(row, update.$set); row.revision += update.$inc.revision; return row },
    findOneAndDelete: async filter => { const index = rows.findIndex(item => match(item, filter)); return index < 0 ? null : rows.splice(index, 1)[0] },
  }
  const auth = (req, res, next) => { const user = req.headers['x-test-user']; if (!user) return res.sendStatus(401); req.user = { _id: user }; next() }
  const app = express(); app.use(express.json()); app.use('/programs', createProgramsRouter(Model, auth))
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve))
  const call = (path, user, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}/programs${path}`, { method, headers: { ...(user ? { 'x-test-user': user } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const program = { name: 'Hello', language: 'python', code: 'print("cloud")', input: '', revision: 0, user: 'bob' }
  try {
    assert.equal((await call('', null)).status, 401)
    assert.equal((await call('/one', 'alice', 'PUT', program)).status, 200)
    assert.equal(rows[0].user, 'alice')
    assert.equal((await (await call('', 'alice')).json()).programs[0].code, program.code)
    assert.deepEqual((await (await call('', 'bob')).json()).programs, [])
    assert.equal((await call('/one', 'bob', 'PUT', { ...program, revision: 1 })).status, 409)
    assert.equal((await call('/one', 'bob', 'DELETE', { revision: 1 })).status, 409)
    assert.equal((await call('/one', 'alice', 'PUT', { ...program, revision: 1, name: 'Renamed' })).status, 200)
    assert.equal((await call('/one', 'alice', 'PUT', { ...program, revision: 1, code: 'stale' })).status, 409)
    assert.equal(rows[0].code, program.code)
    assert.equal((await call('/one', 'alice', 'DELETE', { revision: 1 })).status, 409)
    assert.equal((await call('/one', 'alice', 'DELETE', { revision: 2 })).status, 200)
    assert.deepEqual((await (await call('', 'alice')).json()).programs, [])
    assert.equal((await call('/two', 'alice', 'PUT', { ...program, language: 'unknown' })).status, 400)
    assert.equal((await call('/two', 'alice', 'PUT', { ...program, code: 'x'.repeat(100001) })).status, 400)
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)) }
})
