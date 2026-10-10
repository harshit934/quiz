import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, ShieldAlert } from 'lucide-react'
import { createExamCameraSession } from '../services/examCamera.js'
import './exam-camera.css'

const messages = {
  off: 'Camera monitoring is off.',
  loading: 'Starting camera monitoring…',
  checking: 'Checking face visibility…',
  ok: 'One face detected.',
  'no-face': 'No face detected. Keep your face visible and check your lighting.',
  'multiple-faces': 'Multiple faces detected. Only the exam taker should be in view.',
  paused: 'Monitoring paused. Return to this tab and check your camera.',
}

export default function ExamCameraMonitor() {
  const video = useRef(null)
  const session = useRef(null)
  const [state, setState] = useState({ status: 'off', message: '' })
  useEffect(() => () => session.current?.stop(), [])

  function enable() {
    session.current?.stop()
    session.current = createExamCameraSession({ video: video.current, onStatus: setState })
    session.current.start()
  }
  function disable() {
    session.current?.stop()
    session.current = null
    setState({ status: 'off', message: '' })
  }
  const warning = ['no-face', 'multiple-faces', 'error', 'paused'].includes(state.status)
  const active = !['off', 'error'].includes(state.status)
  return <section className={`exam-panel exam-camera-monitor ${warning ? 'exam-camera-warning' : ''}`} aria-label="Exam camera monitoring">
    <div className="exam-camera-preview">
      <video ref={video} muted playsInline autoPlay aria-label="Your camera preview" hidden={!active} />
      {!active && <CameraOff size={26} aria-hidden="true" />}
    </div>
    <div className="exam-camera-details">
      <h2><Camera size={17} aria-hidden="true" /> Exam camera</h2>
      <p role={warning ? 'alert' : 'status'}>{warning && <ShieldAlert size={16} aria-hidden="true" />}{state.message || messages[state.status]}</p>
      <p className="muted">Face detection only. Video stays on your device and is not recorded. Warnings do not affect your score.</p>
      {active
        ? <button className="button button-quiet" onClick={disable}>Turn off camera</button>
        : <button className="button button-quiet" onClick={enable}>{state.status === 'error' ? 'Retry camera' : 'Enable exam camera'}</button>}
    </div>
  </section>
}
