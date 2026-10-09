import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { request } from './services/api.js'
import { applyLearningOperation, emptyLearning } from '../../shared/learningState.js'
import { readCodingProgress } from './utils/codingProgress.js'
import { readPracticeMistakes } from './utils/practiceMistakes.js'

const Context = createContext(null)
export const useLearning = () => useContext(Context)
export default function LearningProvider({ user, children }) {
  const userId = user?.id || user?._id
  const key = `quizly-learning-${userId || 'guest'}`
  const initial = useRef(null)
  if (!initial.current) {
    try { initial.current = JSON.parse(localStorage.getItem(key) || 'null') } catch { /* fallback below */ }
    initial.current ||= { state: emptyLearning(), pending: [] }
    if (!Array.isArray(initial.current.pending) || !initial.current.state) initial.current = { state: emptyLearning(), pending: [] }
  }
  const current = useRef(initial.current.state), queue = useRef(initial.current.pending)
  const [state, setState] = useState(current.current)
  const [status, setStatus] = useState(userId ? 'Connecting practice cloud…' : 'Practice stays in this browser.')
  const busy = useRef(false), alive = useRef(true)
  const persist = useCallback(() => {
    if (!alive.current) return
    setState(structuredClone(current.current))
    try { localStorage.setItem(key, JSON.stringify({ state: current.current, pending: queue.current })) }
    catch { setStatus('Browser storage is unavailable. Keep this page open until cloud sync finishes.') }
  }, [key])
  const sync = useCallback(async () => {
    if (!userId || busy.current || !alive.current) return
    busy.current = true; setStatus('Syncing practice…')
    try {
      let remote = (await request('/learning')).state
      while (queue.current.length && alive.current) {
        const operations = []
        for (const op of queue.current.slice(0, 20)) {
          if (operations.length && JSON.stringify([...operations, op]).length > 500000) break
          operations.push(op)
        }
        remote = (await request('/learning', { method: 'POST', body: JSON.stringify({ operations }) })).state
        queue.current.splice(0, operations.length)
        current.current = queue.current.reduce(applyLearningOperation, remote)
        persist()
      }
      if (alive.current) { current.current = queue.current.reduce(applyLearningOperation, remote); persist(); setStatus('Practice synced to your account.') }
    } catch (error) {
      if (alive.current) setStatus(`Practice cloud unavailable. Your browser copy is kept. ${error.message}`)
    } finally { busy.current = false }
  }, [userId, persist])
  const dispatch = useCallback((type, data, id = crypto.randomUUID()) => {
    if (current.current.operations?.includes(id) || queue.current.some(op => op.id === id)) return
    const op = { type, data, id }
    current.current = applyLearningOperation(current.current, op)
    queue.current.push(op); persist(); void sync()
  }, [persist, sync])
  useEffect(() => {
    alive.current = true
    const legacyKey = `quizly-coding-progress-${userId || 'guest'}`
    dispatch('import', { progress: readCodingProgress(localStorage, legacyKey), mistakes: readPracticeMistakes(localStorage, legacyKey) }, `import-${userId || 'guest'}-v1`)
    void sync()
    const reconnect = () => void sync()
    window.addEventListener('online', reconnect)
    return () => { alive.current = false; window.removeEventListener('online', reconnect) }
  }, [dispatch, sync, userId])
  return <Context.Provider value={{ state, dispatch, status, sync }}>{children}</Context.Provider>
}
