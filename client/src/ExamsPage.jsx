import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Bookmark, CalendarClock, CheckCircle2,
  Circle, Clock3, Flag, ListChecks, ShieldAlert,
} from 'lucide-react'
import { EmptyState, LoadingState } from './components/ui.jsx'
import { getToken, request } from './services/api.js'

const formatDate = value => new Date(value).toLocaleString()
const formatClock = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`

export default function ExamsPage({ route = [], user, navigate }) {
  const authenticated = Boolean(
    user &&
      getToken() &&
      getToken() !== 'demo-session'
  )
  const [exams, setExams] = useState([])
  const [exam, setExam] = useState(null)
  const [attempt, setAttempt] = useState(null)
  const [answers, setAnswers] = useState([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [starting, setStarting] = useState(false)
  const startPending = useRef(false)
  const submitStarted = useRef(false)

  const [examId, action, attemptId] = route
  const activeAttempt = exam?.attempts?.find(item => item.status === 'in-progress')
  const remainingAttempts = exam ? exam.maxAttempts - (exam.attempts?.length || 0) : 0

  useEffect(() => {
    if (!authenticated) {
      setLoading(false)
      return undefined
    }
    let active = true
    setLoading(true)
    setError('')
    setAccessCode('')
    const load = examId ? request(`/exams/${examId}`) : request('/exams')
    load.then(data => {
      if (!active) return
      if (examId) setExam(data)
      else setExams(data)
    }).catch(loadError => {
      if (active) setError(loadError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [examId, authenticated])

  useEffect(() => {
    if (
      !authenticated ||
      !examId ||
      action !== 'attempt' ||
      !attemptId
    ) {
      setAttempt(null)
      return undefined
    }
    // Starting already returns the full attempt; avoid fetching it twice.
    if (attempt?._id === attemptId && String(attempt.exam) === examId) return undefined
    let active = true
    setLoading(true)
    request(`/exams/${examId}/attempt/${attemptId}`).then(data => {
      if (!active) return
      setAttempt(data)
      setAnswers(data.answers || [])
      setRemaining(data.remainingSeconds || 0)
    }).catch(loadError => {
      if (active) setError(loadError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [authenticated, examId, action, attemptId])

  useEffect(() => {
    if (attempt?.status !== 'in-progress') return undefined
    const timer = window.setInterval(() => {
      setRemaining(value => Math.max(0, value - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [attempt?.status, attempt?._id])

  async function submitAttempt(auto = false) {
    if (!attempt || attempt.status !== 'in-progress' || submitStarted.current) return
    submitStarted.current = true
    setSubmitting(true)
    setError('')
    try {
      const saved = await request(`/exams/${examId}/attempt/${attempt._id}/answers`, {
        method: 'PUT',
        body: JSON.stringify({ answers }),
      })
      if (saved.status !== 'in-progress') {
        setAttempt(saved)
        setRemaining(0)
        setConfirmSubmit(false)
        return
      }
      const submitted = await request(`/exams/${examId}/attempt/${attempt._id}/submit`, { method: 'POST' })
      setAttempt(submitted)
      setRemaining(0)
      setConfirmSubmit(false)
      if (auto) setError('Time expired. Your exam was submitted automatically.')
    } catch (submitError) {
      submitStarted.current = false
      setError(submitError.message)
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (attempt?.status === 'in-progress' && remaining === 0 && attempt.questions?.length) {
      submitAttempt(true)
    }
  }, [remaining, attempt?.status])

  useEffect(() => {
    if (attempt?.status !== 'in-progress') return undefined
    const timeout = window.setTimeout(() => {
      request(`/exams/${examId}/attempt/${attempt._id}/answers`, {
        method: 'PUT',
        body: JSON.stringify({ answers }),
      }).catch(saveError => setError(saveError.message))
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [answers, attempt?.status, attempt?._id, examId])

  async function register() {
    setError('')
    try {
      await request(`/exams/${examId}/register`, { method: 'POST' })
      const refreshed = await request(`/exams/${examId}`)
      setExam(refreshed)
    } catch (registrationError) {
      setError(registrationError.message)
    }
  }

  async function startAttempt() {
    if (startPending.current) return
    startPending.current = true
    setStarting(true)
    setError('')
    try {
      const started = await request(`/exams/${examId}/attempt`, { method: 'POST', body: JSON.stringify({ accessCode }), timeoutMs: 90000 })
      submitStarted.current = false
      setQuestionIndex(0)
      setAttempt(started)
      setAnswers(started.answers || [])
      setRemaining(started.remainingSeconds || 0)
      navigate(`#exams/${examId}/attempt/${started._id}`)
    } catch (startError) {
      setError(startError.name === 'AbortError' ? 'The exam server is taking longer than expected. Try again to resume your attempt.' : startError.message)
    } finally {
      startPending.current = false
      setStarting(false)
    }
  }

  function setAnswer(questionId, update) {
    setAnswers(current => {
      const existing = current.find(answer => answer.questionId === questionId) || { questionId, selectedOption: '', markedForReview: false }
      const next = { ...existing, ...update }
      return [...current.filter(answer => answer.questionId !== questionId), next]
    })
  }

  const currentQuestion = attempt?.questions?.[questionIndex]
  const currentAnswer = currentQuestion && answers.find(answer => answer.questionId === currentQuestion.id)
  const completed = attempt && attempt.status !== 'in-progress'

  if (!authenticated) return <main className="page-width page-main"><section className="exam-panel exam-sign-in"><ShieldAlert size={28} /><h1>Sign in to view exams</h1><p className="muted">Exam registration and attempts are linked to your learner account.</p><button className="button button-primary" onClick={() => navigate('#login')}>Sign in</button></section></main>
  if (loading && !exams.length && !exam && !attempt) return <main className="page-width page-main"><LoadingState label="Loading exams" /></main>

  return (
    <main className={`student-exams page-width page-main ${attempt?.status === 'in-progress' ? 'student-exam-taking' : ''}`}>
      {error && <p className="form-error exam-error" role="alert">{error}</p>}
      {!examId && (
        <>
          <header className="exam-heading"><div><p className="eyebrow">Your assessments</p><h1>Exams</h1><p className="muted">Register for upcoming assessments and continue an active attempt.</p></div></header>
          {exams.length ? <div className="student-exam-grid">{exams.map(item => {
            const latest = item.attempts?.at(-1)
            const open = item.status === 'live'
            return <article className="student-exam-card" key={item._id}>
              <div className="student-exam-card-top"><span className={`exam-status exam-status-${item.status}`}>{item.status}</span><span>{item.difficulty}</span></div>
              <p className="eyebrow">{item.category?.name || 'Exam'}</p><h2>{item.title}</h2><p className="muted">{item.description || 'A scheduled assessment.'}</p>
              <div className="student-exam-meta"><span><ListChecks size={15} /> {item.questionCount} questions</span><span><Clock3 size={15} /> {item.duration} min</span><span><CalendarClock size={15} /> {formatDate(item.startTime)}</span></div>
              <p className="muted">{latest?.status === 'in-progress' ? 'Attempt in progress' : `${Math.max(0, item.maxAttempts - (item.attempts?.length || 0))} attempt(s) remaining`}</p>
              <button className="button button-quiet" onClick={() => navigate(`#exams/${item._id}`)}>{open && latest?.status === 'in-progress' ? 'Continue exam' : 'View exam'} <ArrowRight size={15} /></button>
            </article>
          })}</div> : <EmptyState title="No exams available" detail="Published exams will appear here when they are open for registration or taking." />}
        </>
      )}

      {exam && !attempt && (
        <>
          <button className="back-link exam-back" onClick={() => navigate('#exams')}><ArrowLeft size={15} /> All exams</button>
          <section className="exam-panel student-exam-detail"><div className="student-exam-card-top"><span className={`exam-status exam-status-${exam.status}`}>{exam.status}</span><span>{exam.difficulty}</span></div><p className="eyebrow">{exam.category?.name || 'Exam'}</p><h1>{exam.title}</h1><p className="muted">{exam.description}</p>
            <div className="student-exam-meta"><span><ListChecks size={15} /> {exam.questionCount} questions</span><span><Clock3 size={15} /> {exam.duration} minutes</span><span><CalendarClock size={15} /> {formatDate(exam.startTime)} – {formatDate(exam.endTime)}</span></div>
            <div className="exam-instructions"><h2>Instructions</h2><p>{exam.instructions || 'Answer each question before the exam timer expires. Your score is calculated after submission.'}</p><p>Allowed attempts: {exam.maxAttempts}. Passing score: {exam.passingPercentage}%.</p></div>
            {exam.attempts?.length > 0 && <section className="exam-past-attempts"><h3>Your attempts</h3>{exam.attempts.map(item => <p key={item._id}>Attempt {item.attemptNumber}: {item.status}{item.percentage == null ? '' : ` · ${item.percentage}%`}</p>)}</section>}
            <div className="exam-action-row">
              {exam.requiresAccessCode && exam.registration && exam.status === 'live' && !activeAttempt && remainingAttempts > 0 && <label className="field-label">Exam access code<input maxLength="32" autoComplete="off" placeholder="Enter the code from your admin" value={accessCode} onChange={event => setAccessCode(event.target.value.toUpperCase())} /></label>}
              {!exam.registration && <button className="button button-primary" onClick={register}>Register for exam</button>}
              {exam.registration && exam.status === 'live' && !activeAttempt && remainingAttempts > 0 && <button className="button button-primary" disabled={starting} onClick={startAttempt}>{starting ? 'Starting exam…' : 'Start attempt'}</button>}
              {starting && <span className="muted" role="status">Connecting to the exam server. Please wait.</span>}
              {activeAttempt && <button className="button button-primary" onClick={() => navigate(`#exams/${exam._id}/attempt/${activeAttempt._id}`)}>Continue attempt</button>}
              {exam.registration && remainingAttempts <= 0 && !activeAttempt && <span className="muted">No attempts remaining.</span>}
              {exam.registration && exam.status !== 'live' && <span className="muted">You are registered. The exam is not currently in its start window.</span>}
            </div>
          </section>
        </>
      )}

      {attempt && (
        <>
          <header className="exam-take-heading"><div><p className="eyebrow">{exam?.title || 'Exam attempt'} · Attempt {attempt.attemptNumber}</p><h1>{completed ? 'Attempt submitted' : 'Exam in progress'}</h1></div><div className={`exam-countdown ${remaining < 300 ? 'exam-countdown-warning' : ''}`}><Clock3 size={19} /><span>{formatClock(remaining)}</span></div></header>
          {completed ? <section className="exam-panel exam-result-summary"><CheckCircle2 size={28} /><h2>{attempt.passed ? 'You passed' : 'Attempt complete'}</h2><p className="exam-result-score">{attempt.score} / {attempt.totalMarks} <span>({attempt.percentage}%)</span></p><p className="muted">Correct {attempt.correctAnswers} · Wrong {attempt.wrongAnswers} · Unanswered {attempt.unanswered}</p><button className="button button-quiet" onClick={() => navigate(`#exams/${examId}`)}>Back to exam</button></section> : currentQuestion && (
            <div className="exam-take-layout">
              <section className="exam-panel exam-question-panel">
                <div className="exam-question-progress"><span>Question {questionIndex + 1} of {attempt.questions.length}</span><button className={`exam-review-toggle ${currentAnswer?.markedForReview ? 'marked' : ''}`} onClick={() => setAnswer(currentQuestion.id, { markedForReview: !currentAnswer?.markedForReview })}><Bookmark size={15} /> {currentAnswer?.markedForReview ? 'Marked' : 'Mark for review'}</button></div>
                <h2>{currentQuestion.text}</h2>
                <div className="exam-options">{currentQuestion.options.map((option, index) => <button className={`exam-option ${currentAnswer?.selectedOption === option ? 'selected' : ''}`} key={`${currentQuestion.id}-${index}`} onClick={() => setAnswer(currentQuestion.id, { selectedOption: option })}><span>{String.fromCharCode(65 + index)}</span>{option}{currentAnswer?.selectedOption === option && <CheckCircle2 size={17} />}</button>)}</div>
                <div className="exam-question-navigation"><button className="button button-quiet" disabled={questionIndex === 0} onClick={() => setQuestionIndex(index => index - 1)}><ArrowLeft size={15} /> Previous</button><button className="button button-primary" disabled={questionIndex === attempt.questions.length - 1} onClick={() => setQuestionIndex(index => index + 1)}>Next <ArrowRight size={15} /></button></div>
              </section>
              <aside className="exam-panel exam-question-map"><h3>Question navigator</h3><div>{attempt.questions.map((question, index) => {
                const answer = answers.find(item => item.questionId === question.id)
                return <button key={question.id} className={`${index === questionIndex ? 'current' : ''} ${answer?.selectedOption ? 'answered' : ''} ${answer?.markedForReview ? 'for-review' : ''}`} aria-label={`Question ${index + 1}${answer?.selectedOption ? ', answered' : ', unanswered'}${answer?.markedForReview ? ', marked for review' : ''}`} onClick={() => setQuestionIndex(index)}>{index + 1}</button>
              })}</div><p><Circle size={12} /> Unanswered <CheckCircle2 size={12} /> Answered <Flag size={12} /> Review</p><button className="button button-primary exam-submit-button" disabled={submitting} onClick={() => setConfirmSubmit(true)}>{submitting ? 'Submitting…' : 'Submit exam'}</button></aside>
            </div>
          )}
        </>
      )}

      {confirmSubmit && <div className="exam-modal-backdrop"><section className="exam-panel exam-submit-confirm"><h2>Submit this attempt?</h2><p className="muted">You can’t change answers after submission. Unanswered questions will be scored as blank.</p><div className="exam-action-row"><button className="button button-quiet" onClick={() => setConfirmSubmit(false)}>Keep working</button><button className="button button-primary" disabled={submitting} onClick={() => submitAttempt(false)}>Submit exam</button></div></section></div>}
    </main>
  )
}
