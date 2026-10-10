// Classic worker: MediaPipe's WASM loader requires importScripts.
const VISION_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21'
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'
let detector

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const { FaceDetector, FilesetResolver } = await import(/* @vite-ignore */ `${VISION_ROOT}/vision_bundle.mjs`)
      const fileset = await FilesetResolver.forVisionTasks(`${VISION_ROOT}/wasm`)
      detector = await FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
        runningMode: 'VIDEO', minDetectionConfidence: 0.6,
      })
      self.postMessage({ type: 'ready' })
    } else if (data.type === 'frame' && detector) {
      const result = detector.detectForVideo(data.bitmap, data.timestamp)
      self.postMessage({ type: 'result', count: result.detections.length })
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message })
  } finally {
    data.bitmap?.close()
  }
}
