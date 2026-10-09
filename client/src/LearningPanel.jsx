import { useEffect, useState } from 'react'
import { useLearning } from './LearningContext.jsx'
import { request, readLocalAttempts } from './services/api.js'
import { dayKey, streak, quizReviewRows } from '../../shared/learningState.js'
import './learning.css'

export function BookmarkButton({ item, bookmarkKey }) {
  const learning = useLearning()
  if (!learning) return null
  const saved = Boolean(learning.state.bookmarks[bookmarkKey])
  return <button className="button button-quiet" aria-pressed={saved} onClick={() => learning.dispatch('bookmark', { key: bookmarkKey, item, remove: saved })}>{saved ? 'Bookmarked ✓' : 'Bookmark'}</button>
}
export function RecordQuizLearning({ attempt }) {
  const learning = useLearning()
  useEffect(() => {
    if (!learning || !attempt?._id) return
    learning.dispatch('quiz', { attemptId: String(attempt._id), day: dayKey(new Date(attempt.createdAt || Date.now())), rows: quizReviewRows(attempt) }, `quiz-${attempt._id}`)
  }, [attempt, learning?.dispatch])
  return null
}
export default function LearningPanel({ user, onQuiz, onCoding }) {
  const learning = useLearning()
  const [historyError, setHistoryError] = useState('')
  const [retry, setRetry] = useState(0)
  const [showResolved, setShowResolved] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const timer = setInterval(() => tick(value => value + 1), 60000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    let active = true
    if (!learning || !user) return
    const importAttempts = attempts => {
      if (!active) return
      for (const attempt of [...attempts].reverse()) {
        if (!attempt._id || !Number.isFinite(new Date(attempt.createdAt).getTime())) continue
        learning.dispatch('quiz', { attemptId: String(attempt._id), day: dayKey(new Date(attempt.createdAt)), rows: quizReviewRows(attempt) }, `quiz-${attempt._id}`)
      }
    }
    request('/attempts').then(attempts => { setHistoryError(''); importAttempts(attempts) }).catch(error => { if (active) setHistoryError(`Quiz history could not load. ${error.message}`) })
    importAttempts(readLocalAttempts().filter(item => item.userId === (user.id || user._id)))
    return () => { active = false }
  }, [user?.id, user?._id, learning?.dispatch, retry])
  if (!learning) return null
  const { state, dispatch, status, sync } = learning
  const done = state.days[dayKey()]?.length || 0
  const mistakes = Object.values(state.quizMistakes).filter(row => showResolved || !row.resolved)
  return <section className="learning-panel" aria-label="Learning tools">
    <div className="learning-heading"><h2>Your practice plan</h2><button className="button button-quiet" onClick={sync}>Refresh cloud progress</button></div>
    <p role="status">{status}</p>
    <div className="learning-plan"><div><strong>{streak(state.days)} day streak</strong><p>A completed quiz or a fully passed coding question counts as an active day.</p></div><div><label htmlFor="daily-goal">Daily goal<select id="daily-goal" value={state.goal} onChange={event => dispatch('goal', { goal: Number(event.target.value) })}>{[1, 3, 5, 10].map(goal => <option value={goal} key={goal}>{goal} completed activities</option>)}</select></label><p>{done} / {state.goal} today {done >= state.goal && '✓ Goal reached'}</p><progress aria-label="Daily goal progress" value={Math.min(done, state.goal)} max={state.goal} /></div></div>
    <h3>Bookmarks</h3>
    {!Object.keys(state.bookmarks).length && <p>Bookmark a quiz or coding question to practise it later.</p>}
    {Object.entries(state.bookmarks).map(([key, item]) => <div className="learning-bookmark" key={key}><span>{item.title} · {item.kind === 'coding' ? 'Coding' : 'Quiz'}</span><button className="button button-quiet" onClick={() => item.kind === 'quiz' ? onQuiz?.(item.quizId) : onCoding?.(item.challenge)}>Open</button><button className="button button-quiet" onClick={() => dispatch('bookmark', { key, remove: true })}>Remove bookmark</button></div>)}
    <h3>Quiz mistake review</h3><p>Imports your latest 100 quiz attempts and keeps up to 200 review questions. Practise missed and skipped answers without changing your original quiz score.</p>
    {historyError && <p role="alert">{historyError} <button className="button button-quiet" onClick={() => setRetry(value => value + 1)}>Retry history</button></p>}
    <label><input type="checkbox" checked={showResolved} onChange={event => setShowResolved(event.target.checked)} /> Include resolved mistakes</label>
    {!mistakes.length && <p>No quiz mistakes to review yet.</p>}
    {mistakes.map(row => <QuizMistake key={row.id} row={row} onResolved={() => dispatch('review', { key: row.id })} />)}
  </section>
}
function QuizMistake({ row, onResolved }) {
  const [selected, setSelected] = useState(''), [checked, setChecked] = useState(false)
  const correct = row.question.options[row.question.correctAnswer]
  return <details className="learning-mistake"><summary>{row.title} · {row.question.text} {row.resolved && '✓ Resolved'}</summary><p>Your previous answer: {row.selectedOption || 'Skipped'}</p><fieldset><legend>Try again</legend>{row.question.options.map((option, i) => <label key={i}><input type="radio" name={`review-${row.id}`} checked={selected === option} onChange={() => { setSelected(option); setChecked(false) }} />{option}</label>)}</fieldset><button className="button button-primary" disabled={!selected} onClick={() => { setChecked(true); if (selected === correct) onResolved() }}>Check answer</button>{checked && <div role="status"><p>{selected === correct ? 'Correct. Mistake resolved!' : `Try again. Correct answer: ${correct}`}</p><p>{row.question.explanation || 'No explanation was provided for this question.'}</p></div>}<details><summary>Show answer and explanation</summary><p>{correct}</p><p>{row.question.explanation || 'No explanation was provided for this question.'}</p></details></details>
}
