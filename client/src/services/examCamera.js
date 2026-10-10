export function createFacePresenceTracker() {
  let candidate = ''
  let samples = 0
  return {
    reset() { candidate = ''; samples = 0 },
    observe(count) {
      const next = count === 0 ? 'no-face' : count > 1 ? 'multiple-faces' : 'ok'
      if (next === 'ok') { candidate = ''; samples = 0; return 'ok' }
      samples = next === candidate ? samples + 1 : 1
      candidate = next
      return samples >= 3 ? next : 'checking'
    },
  }
}

export function cameraErrorMessage(error) {
  if (error?.name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access in your browser, then try again.'
  if (error?.name === 'NotFoundError') return 'No camera was found. Connect a camera, then try again.'
  if (error?.name === 'NotReadableError') return 'The camera is busy or unavailable. Close other apps using it, then try again.'
  return 'Camera monitoring is unavailable. Check your camera and internet connection, then try again.'
}

// Every frame stays in this browser. No images or monitoring results are uploaded.
export function createExamCameraSession({
  video, onStatus,
  mediaDevices = navigator.mediaDevices,
  createWorker = () => new Worker(`${import.meta.env.BASE_URL}exam-camera.worker.js`),
  createBitmap = (...args) => createImageBitmap(...args),
  clock = globalThis,
  page = document,
}) {
  let stopped = false
  let stream
  let worker
  let interval
  let loadTimeout
  let frameTimeout
  let busy = false
  let lastVideoTime = -1
  const tracker = createFacePresenceTracker()
  const publish = (status, message = '') => { if (!stopped) onStatus({ status, message }) }

  function stop() {
    stopped = true
    clock.clearInterval(interval)
    clock.clearTimeout(loadTimeout)
    clock.clearTimeout(frameTimeout)
    page.removeEventListener('visibilitychange', visibilityChanged)
    worker?.terminate()
    for (const track of stream?.getTracks() || []) track.stop()
    if (video.srcObject === stream) video.srcObject = null
  }
  function fail(error) {
    publish('error', cameraErrorMessage(error))
    stop()
  }
  function visibilityChanged() {
    tracker.reset()
    publish(page.hidden ? 'paused' : 'checking')
  }
  async function sample() {
    if (stopped || busy || page.hidden || video.readyState < 2) return
    if (video.currentTime === lastVideoTime) return
    lastVideoTime = video.currentTime
    busy = true
    try {
      const bitmap = await createBitmap(video)
      if (stopped) { bitmap.close(); return }
      worker.postMessage({ type: 'frame', bitmap, timestamp: performance.now() }, [bitmap])
      frameTimeout = clock.setTimeout(() => fail(), 15000)
    } catch (error) { fail(error) }
  }
  async function start() {
    publish('loading')
    try {
      if (!mediaDevices?.getUserMedia) throw new Error('Camera unsupported')
      stream = await mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false })
      if (stopped) { for (const track of stream.getTracks()) track.stop(); return }
      const track = stream.getVideoTracks()[0]
      if (!track) throw new Error('No video track')
      track.addEventListener('ended', () => fail())
      track.addEventListener('mute', () => { tracker.reset(); publish('paused') })
      track.addEventListener('unmute', () => publish('checking'))
      video.srcObject = stream
      await video.play()
      if (stopped) return
      worker = createWorker()
      worker.onerror = () => fail()
      worker.onmessage = ({ data }) => {
        if (stopped) return
        if (data.type === 'ready') {
          clock.clearTimeout(loadTimeout)
          publish('checking')
          interval = clock.setInterval(sample, 1000)
          sample()
        } else if (data.type === 'result') {
          clock.clearTimeout(frameTimeout)
          busy = false
          if (!page.hidden && !track.muted) publish(tracker.observe(data.count))
        } else if (data.type === 'error') fail()
      }
      page.addEventListener('visibilitychange', visibilityChanged)
      loadTimeout = clock.setTimeout(() => fail(), 45000)
      worker.postMessage({ type: 'init' })
    } catch (error) { fail(error) }
  }
  return { start, stop }
}
