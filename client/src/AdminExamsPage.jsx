import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpenCheck, CalendarClock,
  CheckCircle2, Clock3, Plus, Shield, UsersRound,
} from 'lucide-react'
import { EmptyState, LoadingState, StatCard } from './components/ui.jsx'
import { request } from './services/api.js'

const statusLabel = status => ({ 'in-progress': 'Taking exam', 'not-started': 'Not started' }[status] || status)
const asId = value => String(value?._id ?? value?.id ?? value ?? '')
const toLocalInput = value => {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocalInput = value => new Date(value).toISOString()

function blankForm() {
  const start = new Date(Date.now() + 60 * 60 * 1000)
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
  return {
    title: '', description: '', instructions: '', category: '', topics: [],
    difficulty: 'Mixed', questionCount: 10, duration: 60,
    startTime: toLocalInput(start), endTime: toLocalInput(end),
    passingPercentage: 60, maxAttempts: 1, selectionMethod: 'manual', questionIds: [],
    status: 'draft',
  }
}

export default function AdminExamsPage({ route = [], navigate }) {
  const [overview, setOverview] = useState(null)
  const [exams, setExams] = useState([])
  const [exam, setExam] = useState(null)
  const [participants, setParticipants] = useState([])
  const [results, setResults] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [questionBank, setQuestionBank] = useState(null)
  const [form, setForm] = useState(null)
  const [attemptDetail, setAttemptDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [examId, page = 'overview'] = route
  const isForm = examId === 'create' || page === 'edit'
  const isCreate = examId === 'create'

  async function loadDashboard() {
    const [summary, list] = await Promise.all([
      request('/exams/admin/overview'),
      request('/exams'),
    ])
    setOverview(summary)
    setExams(list)
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    loadDashboard().catch(loadError => {
      if (active) setError(loadError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!examId || examId === 'create') {
      setExam(null)
      setParticipants([])
      setResults([])
      setAnalytics(null)
      return
    }
    let active = true
    setLoading(true)
    setError('')
    const requestByPage = {
      overview: `/exams/${examId}`,
      participants: `/exams/${examId}/participants`,
      results: `/exams/${examId}/results`,
      analytics: `/exams/${examId}/analytics`,
      edit: `/exams/${examId}`,
    }
    request(requestByPage[page] || requestByPage.overview).then(data => {
      if (!active) return
      if (page === 'participants') setParticipants(data)
      else if (page === 'results') setResults(data)
      else if (page === 'analytics') setAnalytics(data)
      else setExam(data)
    }).catch(loadError => {
      if (active) setError(loadError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [examId, page])

  useEffect(() => {
    if (!isForm) {
      setForm(null)
      setQuestionBank(null)
      return
    }
    let active = true
    setLoading(true)
    Promise.all([
      request('/exams/question-bank'),
      isCreate ? Promise.resolve(null) : request(`/exams/${examId}`),
    ]).then(([bank, existing]) => {
      if (!active) return
      setQuestionBank(bank)
      if (existing) {
        setExam(existing)
        setForm({
          title: existing.title,
          description: existing.description || '',
          instructions: existing.instructions || '',
          category: asId(existing.category),
          topics: (existing.topics || []).map(asId),
          difficulty: existing.difficulty,
          questionCount: existing.questionCount,
          duration: existing.duration,
          startTime: toLocalInput(existing.startTime),
          endTime: toLocalInput(existing.endTime),
          passingPercentage: existing.passingPercentage,
          maxAttempts: existing.maxAttempts,
          status: existing.status === 'draft' ? 'draft' : existing.status === 'scheduled' ? 'scheduled' : 'published',
          selectionMethod: existing.selectionMethod,
          questionIds: (existing.questions || []).map(item => asId(item.question || item)),
        })
      } else {
        setForm(value => value || blankForm())
      }
    }).catch(loadError => {
      if (active) setError(loadError.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [isForm, isCreate, examId])

  const subjects = useMemo(() => (questionBank?.categories || []).filter(category => !category.parentSlug), [questionBank])
  const selectedCategory = questionBank?.categories.find(category => asId(category) === form?.category)
  const availableTopics = selectedCategory
    ? questionBank.categories.filter(category => category.rootSlug === (selectedCategory.rootSlug || selectedCategory.slug) && category.slug !== selectedCategory.slug)
    : []
  const eligibleQuestions = (questionBank?.questions || []).filter(question => {
    const rootSlug = selectedCategory?.rootSlug || selectedCategory?.slug
    return question.category.rootSlug === rootSlug
      && (!form?.topics.length || form.topics.includes(asId(question.category)))
      && (form?.difficulty === 'Mixed' || question.difficulty === form?.difficulty)
  })

  function updateForm(key, value) {
    setForm(current => ({ ...current, [key]: value }))
  }

  function toggleQuestion(questionId) {
    setForm(current => ({
      ...current,
      questionIds: current.questionIds.includes(questionId)
        ? current.questionIds.filter(id => id !== questionId)
        : [...current.questionIds, questionId],
    }))
  }

  async function saveExam(event) {
    event.preventDefault()
    if (form.selectionMethod === 'manual' && form.questionIds.length !== Number(form.questionCount)) {
      setError(`Select exactly ${form.questionCount} questions.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = {
        ...form,
        questionCount: Number(form.questionCount),
        duration: Number(form.duration),
        passingPercentage: Number(form.passingPercentage),
        maxAttempts: Number(form.maxAttempts),
        startTime: fromLocalInput(form.startTime),
        endTime: fromLocalInput(form.endTime),
      }
      const saved = await request(isCreate ? '/exams' : `/exams/${examId}`, {
        method: isCreate ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      })
      await loadDashboard()
      navigate(`#admin/exams/${saved._id}`)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function performAction(action, body) {
    setError('')
    try {
      await request(`/exams/${examId}/${action}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      })
      await Promise.all([loadDashboard(), request(`/exams/${examId}`).then(setExam)])
    } catch (actionError) {
      setError(actionError.message)
    }
  }

  async function deleteExam() {
    if (!window.confirm('Delete this draft exam?')) return
    try {
      await request(`/exams/${examId}`, { method: 'DELETE' })
      await loadDashboard()
      navigate('#admin/exams')
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  async function showAttempt(attemptId) {
    try {
      setAttemptDetail(await request(`/exams/${examId}/attempt/${attemptId}`))
    } catch (detailError) {
      setError(detailError.message)
    }
  }

  if (loading && !overview && !exam && !form) return <main className="page-width page-main"><LoadingState label="Loading exam workspace" /></main>

  return (
    <main className="exam-admin page-width page-main">
      <header className="exam-heading">
        <div>
          <p className="eyebrow"><Shield size={13} /> Separate assessment workspace</p>
          <h1>Exam Management</h1>
          <p className="muted">Create scheduled assessments, monitor participants, and review results.</p>
        </div>
        <button className="button button-quiet" onClick={() => navigate('#admin/dashboard')}><ArrowLeft size={15} /> Quiz admin</button>
      </header>
      {error && <p className="form-error exam-error" role="alert">{error}</p>}

      {!examId && (
        <>
          <section className="exam-stat-grid">
            {[
              ['Total exams', overview?.counts.total ?? '—', BookOpenCheck],
              ['Draft', overview?.counts.draft ?? '—', Clock3],
              ['Scheduled', overview?.counts.scheduled ?? '—', CalendarClock],
              ['Live', overview?.counts.live ?? '—', CheckCircle2],
              ['Completed', overview?.counts.completed ?? '—', BarChart3],
              ['Participants', overview?.totalParticipants ?? '—', UsersRound],
            ].map(([label, value, icon]) => <StatCard key={label} icon={icon} label={label} value={value} accent="violet" />)}
          </section>
          <section className="exam-panel">
            <div className="exam-panel-heading"><div><p className="eyebrow">Assessment library</p><h2>Exams</h2></div><button className="button button-primary" onClick={() => navigate('#admin/exams/create')}><Plus size={16} /> Create exam</button></div>
            {exams.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Exam</th><th>Subject</th><th>Difficulty</th><th>Questions</th><th>Start</th><th>Status</th><th>Actions</th></tr></thead><tbody>
              {exams.map(item => <tr key={item._id}>
                <td><strong>{item.title}</strong><small>{item.duration} minutes</small></td>
                <td>{item.category?.name || '—'}</td><td>{item.difficulty}</td><td>{item.questionCount}</td>
                <td>{new Date(item.startTime).toLocaleString()}</td><td><span className={`exam-status exam-status-${item.status}`}>{item.status}</span></td>
                <td><div className="table-actions"><button onClick={() => navigate(`#admin/exams/${item._id}`)}>Manage</button>{item.status === 'draft' && <button onClick={() => navigate(`#admin/exams/${item._id}/edit`)}>Edit</button>}</div></td>
              </tr>)}
            </tbody></table></div> : <EmptyState title="No exams created" detail="Create a separate exam using questions from the existing question bank." />}
          </section>
          <section className="exam-panel">
            <div className="exam-panel-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent exams</h2></div></div>
            {(overview?.recentExams || []).slice(0, 5).map(item => <button className="exam-recent-row" key={item._id} onClick={() => navigate(`#admin/exams/${item._id}`)}><span><strong>{item.title}</strong><small>{item.category} · {item.participants} participants</small></span><span className={`exam-status exam-status-${item.status}`}>{item.status}</span></button>)}
          </section>
        </>
      )}

      {isForm && form && questionBank && (
        <>
          <button className="back-link exam-back" onClick={() => navigate(isCreate ? '#admin/exams' : `#admin/exams/${examId}`)}><ArrowLeft size={15} /> Back to exams</button>
          <form className="exam-panel exam-form" onSubmit={saveExam}>
            <div className="exam-panel-heading"><div><p className="eyebrow">{isCreate ? 'New assessment' : 'Update draft'}</p><h2>{isCreate ? 'Create exam' : 'Edit exam'}</h2></div></div>
            <div className="exam-fields">
              <label className="field-label exam-field-wide">Exam title<input required minLength="3" maxLength="120" value={form.title} onChange={event => updateForm('title', event.target.value)} /></label>
              <label className="field-label exam-field-wide">Description<textarea rows="2" maxLength="1000" value={form.description} onChange={event => updateForm('description', event.target.value)} /></label>
              <label className="field-label exam-field-wide">Instructions<textarea rows="3" maxLength="5000" value={form.instructions} onChange={event => updateForm('instructions', event.target.value)} /></label>
              <label className="field-label">Subject<select required value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value, topics: [], questionIds: [] }))}><option value="">Choose a subject</option>{subjects.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
              <label className="field-label">Difficulty<select value={form.difficulty} onChange={event => setForm(current => ({ ...current, difficulty: event.target.value, questionIds: [] }))}>{['Easy', 'Medium', 'Hard', 'Mixed'].map(item => <option key={item}>{item}</option>)}</select></label>
              {availableTopics.length > 0 && <fieldset className="exam-topics exam-field-wide"><legend>Topics <span className="optional-label">(leave empty to include all subject topics)</span></legend><div>{availableTopics.map(topic => <label key={topic._id}><input type="checkbox" checked={form.topics.includes(topic._id)} onChange={() => setForm(current => ({ ...current, topics: current.topics.includes(topic._id) ? current.topics.filter(id => id !== topic._id) : [...current.topics, topic._id], questionIds: [] }))} />{topic.name}</label>)}</div></fieldset>}
              <label className="field-label">Question selection<select value={form.selectionMethod} onChange={event => updateForm('selectionMethod', event.target.value)}><option value="manual">Select from question bank</option><option value="random">Random from eligible question bank</option></select></label>
              <label className="field-label">Number of questions<input type="number" min="1" max="200" required value={form.questionCount} onChange={event => updateForm('questionCount', event.target.value)} /></label>
              <label className="field-label">Duration (minutes)<input type="number" min="1" max="600" required value={form.duration} onChange={event => updateForm('duration', event.target.value)} /></label>
              <label className="field-label">Start date and time<input type="datetime-local" required value={form.startTime} onChange={event => updateForm('startTime', event.target.value)} /></label>
              <label className="field-label">End date and time<input type="datetime-local" required value={form.endTime} onChange={event => updateForm('endTime', event.target.value)} /></label>
              <label className="field-label">Passing percentage<input type="number" min="0" max="100" required value={form.passingPercentage} onChange={event => updateForm('passingPercentage', event.target.value)} /></label>
              <label className="field-label">Maximum attempts<input type="number" min="1" max="20" required value={form.maxAttempts} onChange={event => updateForm('maxAttempts', event.target.value)} /></label>
              {examId
                ? <p className="muted">Change publication status from the exam management controls after saving.</p>
                : <label className="field-label">Initial status<select value={form.status} onChange={event => updateForm('status', event.target.value)}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option></select></label>}
            </div>
            {form.selectionMethod === 'manual' && <section className="exam-question-picker"><div className="exam-panel-heading"><div><p className="eyebrow">Existing question bank</p><h3>Select {form.questionCount} questions</h3></div><span className="count-note">{form.questionIds.length} selected</span></div>
              <div className="exam-bank-list">{eligibleQuestions.map(question => <label className="exam-bank-question" key={question.id}><input type="checkbox" checked={form.questionIds.includes(question.id)} disabled={!form.questionIds.includes(question.id) && form.questionIds.length >= Number(form.questionCount)} onChange={() => toggleQuestion(question.id)} /><span><strong>{question.text}</strong><small>{question.category.name} · {question.quizTitle} · {question.difficulty}</small></span></label>)}
                {!eligibleQuestions.length && <p className="muted">No questions match these filters. Choose another subject, topic, or difficulty.</p>}
              </div>
            </section>}
            {form.selectionMethod === 'random' && <p className="exam-help">The server will randomly select unique questions from this subject/topic and difficulty when saving the draft.</p>}
            <div className="exam-form-actions"><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save as draft'}</button><button className="button button-quiet" type="button" onClick={() => navigate(isCreate ? '#admin/exams' : `#admin/exams/${examId}`)}>Cancel</button></div>
          </form>
        </>
      )}

      {examId && examId !== 'create' && exam && !isForm && page === 'overview' && (
        <>
          <button className="back-link exam-back" onClick={() => navigate('#admin/exams')}><ArrowLeft size={15} /> All exams</button>
          <section className="exam-panel exam-detail-heading"><div><p className="eyebrow">{exam.category?.name || 'Exam'} · {exam.difficulty}</p><h2>{exam.title}</h2><p className="muted">{exam.description}</p></div><span className={`exam-status exam-status-${exam.status}`}>{exam.status}</span></section>
          <section className="exam-stat-grid exam-detail-stats">
            <StatCard icon={BookOpenCheck} label="Questions" value={exam.questionCount} detail={`${exam.duration} minutes`} />
            <StatCard icon={UsersRound} label="Participants" value={overview?.recentExams.find(item => item._id === exam._id)?.participants ?? '—'} detail={`${exam.maxAttempts} max attempts`} />
            <StatCard icon={CalendarClock} label="Start time" value={new Date(exam.startTime).toLocaleDateString()} detail={new Date(exam.startTime).toLocaleTimeString()} />
            <StatCard icon={CheckCircle2} label="Passing score" value={`${exam.passingPercentage}%`} detail={`Ends ${new Date(exam.endTime).toLocaleString()}`} />
          </section>
          <section className="exam-panel"><div className="exam-panel-heading"><div><p className="eyebrow">Management</p><h3>Exam controls</h3></div></div>
            <div className="exam-action-row">
              {exam.status === 'draft' && <button className="button button-primary" onClick={() => performAction('publish')}>Publish / schedule</button>}
              {['published', 'scheduled'].includes(exam.status) && <button className="button button-quiet" onClick={() => performAction('unpublish')}>Unpublish</button>}
              {['published', 'scheduled'].includes(exam.status) && <button className="button button-primary" onClick={() => performAction('start')}>Start exam</button>}
              {['published', 'scheduled', 'live'].includes(exam.status) && <button className="button button-quiet" onClick={() => performAction('end')}>End exam</button>}
              {!['completed', 'cancelled'].includes(exam.status) && <button className="button button-quiet" onClick={() => performAction('cancel')}>Cancel exam</button>}
              {exam.canEdit && <button className="button button-quiet" onClick={() => navigate(`#admin/exams/${examId}/edit`)}>Edit</button>}
              {exam.canEdit && <button className="button button-danger" onClick={deleteExam}>Delete exam</button>}
            </div>
          </section>
          <nav className="exam-subnav"><button onClick={() => navigate(`#admin/exams/${examId}/participants`)}>Participants</button><button onClick={() => navigate(`#admin/exams/${examId}/results`)}>Results</button><button onClick={() => navigate(`#admin/exams/${examId}/analytics`)}>Analytics</button></nav>
        </>
      )}

      {examId && examId !== 'create' && page === 'participants' && (
        <section className="exam-panel"><div className="exam-panel-heading"><div><p className="eyebrow">Live monitoring</p><h2>Participants</h2></div><button className="button button-quiet" onClick={() => navigate(`#admin/exams/${examId}`)}><ArrowLeft size={15} /> Exam details</button></div>
          <div className="exam-stat-grid exam-participant-stats">
            <StatCard icon={UsersRound} label="Registered" value={participants.length} />
            <StatCard icon={Clock3} label="Currently taking" value={participants.filter(item => item.latestAttempt?.status === 'in-progress' && item.latestAttempt.remainingSeconds > 0).length} />
            <StatCard icon={CheckCircle2} label="Completed" value={participants.filter(item => ['completed', 'expired'].includes(item.latestAttempt?.status)).length} />
            <StatCard icon={CalendarClock} label="Not started" value={participants.filter(item => !item.latestAttempt).length} />
          </div>
          {participants.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Student</th><th>Status</th><th>Attempts</th><th>Started</th><th>Submitted</th><th>Remaining time</th><th>Latest result</th></tr></thead><tbody>{participants.map(item => <tr key={item.student.id}><td><button className="exam-participant-link" disabled={!item.latestAttempt} onClick={() => item.latestAttempt && showAttempt(item.latestAttempt._id)}><strong>{item.student.name}</strong><small>{item.student.username || item.student.email}</small></button></td><td>{statusLabel(item.status)}</td><td>{item.attemptsUsed}</td><td>{item.latestAttempt?.startedAt ? new Date(item.latestAttempt.startedAt).toLocaleString() : '—'}</td><td>{item.latestAttempt?.submittedAt ? new Date(item.latestAttempt.submittedAt).toLocaleString() : '—'}</td><td>{item.latestAttempt?.status === 'in-progress' ? `${Math.floor(item.latestAttempt.remainingSeconds / 60)}m ${item.latestAttempt.remainingSeconds % 60}s` : '—'}</td><td>{item.latestAttempt?.percentage == null ? '—' : `${item.latestAttempt.percentage}%`}</td></tr>)}</tbody></table></div> : <EmptyState title="No registrations yet" detail="Registered students will appear here." />}
        </section>
      )}

      {examId && examId !== 'create' && page === 'results' && (
        <section className="exam-panel"><div className="exam-panel-heading"><div><p className="eyebrow">Scored submissions</p><h2>Exam results</h2></div><button className="button button-quiet" onClick={() => navigate(`#admin/exams/${examId}`)}><ArrowLeft size={15} /> Exam details</button></div>
          {results.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Student</th><th>Score</th><th>Percentage</th><th>Correct / wrong / blank</th><th>Time taken</th><th>Attempt</th><th>Outcome</th></tr></thead><tbody>{results.map(result => <tr key={result.id} onClick={() => showAttempt(result.id)} className="exam-click-row"><td><strong>{result.student.name}</strong><small>{result.student.username || result.student.email}</small></td><td>{result.score} / {result.totalMarks}</td><td>{result.percentage}%</td><td>{result.correctAnswers} / {result.wrongAnswers} / {result.unanswered}</td><td>{Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s</td><td>{result.attemptNumber}</td><td>{result.passed ? 'Passed' : 'Failed'}</td></tr>)}</tbody></table></div> : <EmptyState title="No submitted results" detail="Completed exam attempts will appear here." />}
        </section>
      )}

      {examId && examId !== 'create' && page === 'analytics' && analytics && (
        <section className="exam-panel"><div className="exam-panel-heading"><div><p className="eyebrow">Performance</p><h2>Exam analytics</h2></div><button className="button button-quiet" onClick={() => navigate(`#admin/exams/${examId}`)}><ArrowLeft size={15} /> Exam details</button></div>
          <div className="exam-stat-grid">
            {[
              ['Participants', analytics.totalParticipants], ['Attempted', analytics.attempted], ['Completed', analytics.completed],
              ['Passed', analytics.passed], ['Failed', analytics.failed], ['Pass rate', `${analytics.passPercentage}%`],
              ['Average score', `${analytics.averageScore}%`], ['High / low', `${analytics.highestScore}% / ${analytics.lowestScore}%`],
              ['Avg. time', `${Math.floor(analytics.averageCompletionTime / 60)}m ${analytics.averageCompletionTime % 60}s`],
            ].map(([label, value]) => <article className="exam-mini-stat" key={label}><span>{label}</span><strong>{value}</strong></article>)}
          </div>
          <h3 className="exam-subheading">Question accuracy</h3>
          <div className="exam-accuracy-list">{analytics.questionAccuracy.map((item, index) => <div className="exam-accuracy-row" key={item.questionId}><span><b>{index + 1}.</b> {item.text}</span><strong>{item.accuracy}% <small>{item.correct}/{item.attempted} correct</small></strong><i style={{ '--accuracy': `${item.accuracy}%` }} /></div>)}</div>
        </section>
      )}

      {attemptDetail && <div className="exam-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setAttemptDetail(null)}><section className="exam-panel exam-attempt-modal" role="dialog" aria-modal="true" aria-label="Attempt detail"><div className="exam-panel-heading"><div><p className="eyebrow">Attempt detail</p><h2>Question review</h2></div><button className="button button-quiet" onClick={() => setAttemptDetail(null)}>Close</button></div>{attemptDetail.questions.map((question, index) => { const answer = attemptDetail.answers.find(item => item.questionId === question.question); return <article className="exam-review-question" key={question.question}><h3>{index + 1}. {question.text}</h3><p>Selected: {answer?.selectedOption || 'Unanswered'}</p><p>Correct answer: {question.options[question.correctAnswer]}</p></article> })}</section></div>}
    </main>
  )
}
