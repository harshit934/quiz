import test from 'node:test'
import assert from 'node:assert/strict'
import { createExamCameraSession, createFacePresenceTracker } from './examCamera.js'

test('face warnings require consecutive samples and recover immediately', () => {
  const tracker = createFacePresenceTracker()
  assert.equal(tracker.observe(1), 'ok')
  assert.equal(tracker.observe(0), 'checking')
  assert.equal(tracker.observe(0), 'checking')
  assert.equal(tracker.observe(0), 'no-face')
  assert.equal(tracker.observe(1), 'ok')
  assert.equal(tracker.observe(2), 'checking')
  assert.equal(tracker.observe(2), 'checking')
  assert.equal(tracker.observe(2), 'multiple-faces')
  tracker.reset()
  assert.equal(tracker.observe(2), 'checking')
  assert.equal(tracker.observe(0), 'checking')
})

function fixture() {
  const states = []
  const timers = new Map()
  let sequence = 0
  const page = new EventTarget()
  page.hidden = false
  const track = new EventTarget()
  track.stopped = false
  track.stop = () => { track.stopped = true }
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  const video = { srcObject: null, readyState: 2, currentTime: 1, play: async () => {} }
  const messages = []
  const worker = { postMessage: data => messages.push(data), terminate() { this.terminated = true } }
  const options = {
    video, page, onStatus: state => states.push(state),
    mediaDevices: { getUserMedia: async constraints => { assert.equal(constraints.audio, false); return stream } },
    createWorker: () => worker,
    createBitmap: async () => ({ close() { this.closed = true } }),
    clock: {
      setTimeout(callback, delay) { timers.set(++sequence, { callback, delay }); return sequence },
      clearTimeout(id) { timers.delete(id) },
      setInterval(callback, delay) { timers.set(++sequence, { callback, delay }); return sequence },
      clearInterval(id) { timers.delete(id) },
    },
  }
  return { options, states, timers, page, track, stream, video, worker, messages }
}

test('camera session shuts down tracks, worker and timers on exam exit', async () => {
  const f = fixture()
  const session = createExamCameraSession(f.options)
  await session.start()
  assert.equal(f.video.srcObject, f.stream)
  assert.equal(f.messages[0].type, 'init')
  f.worker.onmessage({ data: { type: 'ready' } })
  await Promise.resolve()
  assert.equal(f.messages[1].type, 'frame')
  for (let index = 0; index < 3; index++) f.worker.onmessage({ data: { type: 'result', count: 0 } })
  assert.equal(f.states.at(-1).status, 'no-face')
  f.worker.onmessage({ data: { type: 'result', count: 1 } })
  assert.equal(f.states.at(-1).status, 'ok')
  f.page.hidden = true
  f.page.dispatchEvent(new Event('visibilitychange'))
  assert.equal(f.states.at(-1).status, 'paused')
  f.worker.onmessage({ data: { type: 'result', count: 0 } })
  assert.equal(f.states.at(-1).status, 'paused')
  session.stop()
  assert.equal(f.track.stopped, true)
  assert.equal(f.worker.terminated, true)
  assert.equal(f.video.srcObject, null)
  assert.equal(f.timers.size, 0)
  const count = f.states.length
  f.page.hidden = false
  f.page.dispatchEvent(new Event('visibilitychange'))
  assert.equal(f.states.length, count)
})

test('permission denial gives a retryable error without starting a detector', async () => {
  const f = fixture()
  f.options.mediaDevices.getUserMedia = async () => { throw new DOMException('Denied', 'NotAllowedError') }
  await createExamCameraSession(f.options).start()
  assert.equal(f.states.at(-1).status, 'error')
  assert.match(f.states.at(-1).message, /permission was denied/)
  assert.equal(f.messages.length, 0)
  assert.equal(f.timers.size, 0)
})

test('leaving while permission is pending stops a late-arriving stream', async () => {
  const f = fixture()
  let resolve
  f.options.mediaDevices.getUserMedia = () => new Promise(done => { resolve = done })
  const session = createExamCameraSession(f.options)
  const starting = session.start()
  session.stop()
  resolve(f.stream)
  await starting
  assert.equal(f.track.stopped, true)
  assert.equal(f.video.srcObject, null)
  assert.equal(f.messages.length, 0)
})

test('failed model loading releases the camera and permits a clean retry', async () => {
  const f = fixture()
  const session = createExamCameraSession(f.options)
  await session.start()
  f.worker.onmessage({ data: { type: 'error' } })
  assert.equal(f.states.at(-1).status, 'error')
  assert.equal(f.track.stopped, true)
  assert.equal(f.worker.terminated, true)
  assert.equal(f.timers.size, 0)
})

test('stalled detector times out and releases the camera', async () => {
  const f = fixture()
  await createExamCameraSession(f.options).start()
  const timeout = [...f.timers.values()].find(timer => timer.delay === 45000)
  timeout.callback()
  assert.equal(f.states.at(-1).status, 'error')
  assert.equal(f.track.stopped, true)
  assert.equal(f.timers.size, 0)
})
