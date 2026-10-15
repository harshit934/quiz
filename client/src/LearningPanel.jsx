import { useEffect, useState } from 'react'
import { useLearning } from './LearningContext.jsx'
import { getToken, request, readLocalAttempts } from './services/api.js'
import { dayKey, streak, quizReviewRows } from '../../shared/learningState.js'
import './learning.css'

export function BookmarkButton({ item, bookmarkKey }) {
  const learning = useLearning()
  if (!learning) return null
  const saved = Boolean(learning.state.bookmarks[bookmarkKey])
  return <button className="button button-quiet" aria-pressed={saved} onClick={() => learning.dispatch('bookmark', { key: bookmarkKey, item, remove: saved })}>{saved ? 'Bookmarked ✓' : 'Bookmark'}</button>
}
export function QuestionBookmarkButton({ questionId }) {
  const [bookmarked, setBookmarked] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const token = getToken()
  const available = Boolean(token && token !== 'demo-session' && /^[a-f\d]{24}$/i.test(String(questionId || '')))
  useEffect(() => {
    let active = true
    if (!available) { setBusy(false); return undefined }
    setBusy(true)
    request(`/bookmarks/${questionId}`)
      .then(data => { if (active) setBookmarked(data.bookmarked) })
      .catch(loadError => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, [available, questionId, token])
  if (!available) return null
  async function toggle() {
    setBusy(true)
    setError('')
    try {
      if (bookmarked) {
        await request(`/bookmarks/${questionId}`, { method: 'DELETE' })
        setBookmarked(false)
      } else {
        await request(`/bookmarks/${questionId}`, { method: 'PUT' })
        setBookmarked(true)
      }
    } catch (toggleError) {
      setError(toggleError.message)
    } finally {
      setBusy(false)
    }
  }
  return <span className="question-bookmark-control"><button className="button button-quiet" aria-pressed={bookmarked} disabled={busy} onClick={toggle}>{busy ? 'Loading…' : bookmarked ? 'Saved question' : 'Save question'}</button>{error && <span role="alert">{error}</span>}</span>
}
export function RecordQuizLearning({ attempt }) {
  const learning = useLearning()
  useEffect(() => {
    if (!learning || !/^[a-f\d]{24}$/i.test(String(attempt?._id || ''))) return
    learning.dispatch('quiz', { attemptId: String(attempt._id), day: dayKey(new Date(attempt.createdAt || Date.now())), rows: quizReviewRows(attempt) }, `quiz-${attempt._id}`)
  }, [attempt, learning?.dispatch])
  return null
}
export default function LearningPanel({ user, onQuiz, onCoding }) {
  const learning = useLearning()
  const [historyError, setHistoryError] = useState('')
  const [retry, setRetry] = useState(0)
  const [showResolved, setShowResolved] = useState(false)
  const [subjectFilter, setSubjectFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('all')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [recommendations, setRecommendations] = useState([])
  const [recommendationError, setRecommendationError] = useState('')
  const [weakAreas, setWeakAreas] = useState([])
  const [weakAreaError, setWeakAreaError] = useState('')
  const [gamification, setGamification] = useState(null)
  const [gamificationError, setGamificationError] = useState('')
  const [questionBookmarks, setQuestionBookmarks] = useState([])
  const [bookmarkError, setBookmarkError] = useState('')
  const [bookmarkSubject, setBookmarkSubject] = useState('all')
  const [bookmarkTopic, setBookmarkTopic] = useState('all')
  const [bookmarkDifficulty, setBookmarkDifficulty] = useState('all')
  const [selectedBookmarkIds, setSelectedBookmarkIds] = useState([])
  const [practiceCount, setPracticeCount] = useState(10)
  const [shufflePractice, setShufflePractice] = useState(true)
  const [creatingPractice, setCreatingPractice] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const timer = setInterval(() => tick(value => value + 1), 60000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    let active = true
    if (!learning || !user) return
    const importAttempts = attempts => {
      if (!active) return
      for (const attempt of [...attempts].reverse()) {
        if (!/^[a-f\d]{24}$/i.test(String(attempt._id || '')) || !Number.isFinite(new Date(attempt.createdAt).getTime())) continue
        learning.dispatch('quiz', { attemptId: String(attempt._id), day: dayKey(new Date(attempt.createdAt)), rows: quizReviewRows(attempt) }, `quiz-${attempt._id}`)
      }
    }
    request('/attempts').then(attempts => { setHistoryError(''); importAttempts(attempts) }).catch(error => { if (active) setHistoryError(`Quiz history could not load. ${error.message}`) })
    importAttempts(readLocalAttempts().filter(item => item.userId === (user.id || user._id)))
    return () => { active = false }
  }, [user?.id, user?._id, learning?.dispatch, retry])
  useEffect(() => {
    let active = true
    if (!user) return undefined
    request('/users/recommendations')
      .then(data => {
        if (active) {
          setRecommendations(data.recommendations || [])
          setRecommendationError('')
        }
      })
      .catch(error => {
        if (active) setRecommendationError(`Recommendations could not load. ${error.message}`)
      })
    return () => { active = false }
  }, [user?.id, user?._id])
  useEffect(() => {
    let active = true
    if (!user) return undefined
    request('/users/weak-areas')
      .then(data => {
        if (active) {
          setWeakAreas(data.areas || [])
          setWeakAreaError('')
        }
      })
      .catch(error => {
        if (active) setWeakAreaError(`Topic analysis could not load. ${error.message}`)
      })
    return () => { active = false }
  }, [user?.id, user?._id])
  useEffect(() => {
    let active = true
    if (!user) return undefined
    request('/bookmarks')
      .then(data => { if (active) { setQuestionBookmarks(data); setBookmarkError('') } })
      .catch(error => { if (active) setBookmarkError(`Saved questions could not load. ${error.message}`) })
    return () => { active = false }
  }, [user?.id, user?._id])
  useEffect(() => {
    let active = true
    if (!user) return undefined
    request('/users/gamification')
      .then(data => {
        if (active) {
          setGamification(data)
          setGamificationError('')
        }
      })
      .catch(error => {
        if (active) setGamificationError(`Gamification progress could not load. ${error.message}`)
      })
    return () => { active = false }
  }, [user?.id, user?._id])
  if (!learning) return null
  const { state, dispatch, status, sync } = learning
  const done = state.days[dayKey()]?.length || 0
  const allMistakes = Object.values(state.quizMistakes)
  const subjects = [...new Set(allMistakes.map(row => row.subject).filter(Boolean))].sort()
  const topics = [...new Set(allMistakes.map(row => row.topic).filter(Boolean))].sort()
  const difficulties = [...new Set(allMistakes.map(row => row.difficulty).filter(Boolean))].sort()
  const mistakes = allMistakes.filter(row => (showResolved || !row.resolved)
    && (subjectFilter === 'all' || row.subject === subjectFilter)
    && (topicFilter === 'all' || row.topic === topicFilter)
    && (difficultyFilter === 'all' || row.difficulty === difficultyFilter))
  const bookmarkSubjects = [...new Set(questionBookmarks.map(item => item.quiz.category?.name).filter(Boolean))].sort()
  const bookmarkTopics = [...new Set(questionBookmarks.map(item => item.quiz.category?.topic).filter(Boolean))].sort()
  const bookmarkDifficulties = [...new Set(questionBookmarks.map(item => item.quiz.difficulty).filter(Boolean))].sort()
  const visibleBookmarks = questionBookmarks.filter(item => (bookmarkSubject === 'all' || item.quiz.category?.name === bookmarkSubject)
    && (bookmarkTopic === 'all' || item.quiz.category?.topic === bookmarkTopic)
    && (bookmarkDifficulty === 'all' || item.quiz.difficulty === bookmarkDifficulty))
  const selectedVisibleBookmarkIds = selectedBookmarkIds.filter(id => questionBookmarks.some(item => item.questionId === id))
  async function createBookmarkPractice() {
    if (!selectedVisibleBookmarkIds.length) return
    const chosenIds = selectedVisibleBookmarkIds.slice(0, 50)
    setCreatingPractice(true)
    setBookmarkError('')
    try {
      const result = await request('/bookmarks/practice', {
        method: 'POST',
        body: JSON.stringify({
          questionIds: chosenIds,
          questionCount: Math.min(practiceCount, chosenIds.length),
          shuffle: shufflePractice,
        }),
      })
      onQuiz?.(result.id)
    } catch (error) {
      setBookmarkError(`Could not create practice quiz. ${error.message}`)
    } finally {
      setCreatingPractice(false)
    }
  }
  return <section className="learning-panel" aria-label="Learning tools">
    <div className="learning-heading"><h2>Your practice plan</h2><button className="button button-quiet" onClick={sync}>Refresh cloud progress</button></div>
    <p role="status">{status}</p>
    <h3>Level {gamification?.level ?? '—'} · {gamification?.totalXp ?? '—'} XP</h3>
    {gamificationError && <p role="alert">{gamificationError}</p>}
    {gamification && <div className="learning-gamification"><p><strong>{gamification.streakDays} day verified quiz streak</strong> · {gamification.xpToNextLevel} XP to level {gamification.level + 1}</p><progress aria-label="Progress to next level" value={gamification.xpIntoLevel} max="100" /><div className="learning-challenges"><span>Daily challenge: {gamification.challenges.daily.completed}/{gamification.challenges.daily.goal} distinct quiz · +{gamification.challenges.daily.rewardXp} XP</span><span>Weekly challenge: {gamification.challenges.weekly.completed}/{gamification.challenges.weekly.goal} distinct quizzes · +{gamification.challenges.weekly.rewardXp} XP</span></div></div>}
    <div className="learning-plan"><div><strong>{streak(state.days)} day practice activity streak</strong><p>A completed quiz or a fully passed coding question counts as an activity in this browser-synced practice plan.</p></div><div><label htmlFor="daily-goal">Daily goal<select id="daily-goal" value={state.goal} onChange={event => dispatch('goal', { goal: Number(event.target.value) })}>{[1, 3, 5, 10].map(goal => <option value={goal} key={goal}>{goal} completed activities</option>)}</select></label><p>{done} / {state.goal} today {done >= state.goal && '✓ Goal reached'}</p><progress aria-label="Daily goal progress" value={Math.min(done, state.goal)} max={state.goal} /></div></div>
    <h3>Recommended practice</h3>
    {recommendationError && <p role="alert">{recommendationError}</p>}
    {recommendations.length > 0 && <div className="learning-recommendations">{recommendations.map(item => <article className="learning-recommendation" key={item.quiz._id}><div><strong>{item.quiz.title}</strong><span>{item.quiz.category?.name || 'Quiz'} · {item.quiz.difficulty} · {item.quiz.totalQuestions} questions</span><p>{item.reason}</p>{item.progress && <><progress aria-label={`${item.progress.area} progress toward 70 percent`} value={item.progress.percentToTarget} max="100" /><small>{item.progress.average}% average · target {item.progress.target}%</small></>}</div><button className="button button-quiet" onClick={() => onQuiz?.(item.quiz._id)}>Practice</button></article>)}</div>}
    {!recommendations.length && !recommendationError && <p>No recommendations are available right now.</p>}
    <h3>Topic-wise performance</h3>
    <p className="muted">Based on your saved, server-graded quiz attempts.</p>
    {weakAreaError && <p role="alert">{weakAreaError}</p>}
    {!weakAreas.length && !weakAreaError && <p>Complete a quiz to see performance by subject and topic.</p>}
    <div className="learning-weak-areas">{weakAreas.map(area => <article key={area.categoryId || `${area.subject}-${area.topic}`}><div><strong>{area.subject} · {area.topic}</strong><span>{area.average}% average · {area.attemptCount} verified attempt{area.attemptCount === 1 ? '' : 's'}</span><progress aria-label={`${area.subject} ${area.topic} average score`} value={area.average} max="100" /></div>{area.practiceQuiz && <button className="button button-quiet" onClick={() => onQuiz?.(area.practiceQuiz.id)}>Practice {area.topic}</button>}</article>)}</div>
    <h3>Bookmarks</h3>
    {!Object.keys(state.bookmarks).length && <p>Bookmark a quiz or coding question to practise it later.</p>}
    {Object.entries(state.bookmarks).map(([key, item]) => <div className="learning-bookmark" key={key}><span>{item.title} · {item.kind === 'coding' ? 'Coding' : 'Quiz'}</span><button className="button button-quiet" onClick={() => item.kind === 'quiz' ? onQuiz?.(item.quizId) : onCoding?.(item.challenge)}>Open</button><button className="button button-quiet" onClick={() => dispatch('bookmark', { key, remove: true })}>Remove bookmark</button></div>)}
    <h3>Saved questions</h3>
    {bookmarkError && <p role="alert">{bookmarkError}</p>}
    <div className="learning-filters">
      <label>Subject<select value={bookmarkSubject} onChange={event => setBookmarkSubject(event.target.value)}><option value="all">All subjects</option>{bookmarkSubjects.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Topic<select value={bookmarkTopic} onChange={event => setBookmarkTopic(event.target.value)}><option value="all">All topics</option>{bookmarkTopics.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Difficulty<select value={bookmarkDifficulty} onChange={event => setBookmarkDifficulty(event.target.value)}><option value="all">All difficulties</option>{bookmarkDifficulties.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="learning-custom-practice">
      <label><input type="checkbox" checked={visibleBookmarks.length > 0 && visibleBookmarks.every(item => selectedBookmarkIds.includes(item.questionId))} onChange={event => setSelectedBookmarkIds(current => event.target.checked
        ? [...new Set([...current, ...visibleBookmarks.map(item => item.questionId)])]
        : current.filter(id => !visibleBookmarks.some(item => item.questionId === id)))} /> Select all filtered questions</label>
      <label>Number of questions<select value={Math.min(practiceCount, Math.max(1, Math.min(50, selectedVisibleBookmarkIds.length)))} onChange={event => setPracticeCount(Number(event.target.value))} disabled={!selectedVisibleBookmarkIds.length}>{[5, 10, 15, 20, 30, 50].filter(count => count <= Math.min(50, selectedVisibleBookmarkIds.length)).map(count => <option key={count} value={count}>{count}</option>)}{selectedVisibleBookmarkIds.length > 0 && ![5, 10, 15, 20, 30, 50].includes(Math.min(50, selectedVisibleBookmarkIds.length)) && <option value={Math.min(50, selectedVisibleBookmarkIds.length)}>{Math.min(50, selectedVisibleBookmarkIds.length)}</option>}</select></label>
      <label><input type="checkbox" checked={shufflePractice} onChange={event => setShufflePractice(event.target.checked)} /> Shuffle questions</label>
      <button className="button button-primary" disabled={creatingPractice || !selectedVisibleBookmarkIds.length} onClick={createBookmarkPractice}>{creatingPractice ? 'Creating…' : `Create quiz (${selectedVisibleBookmarkIds.length} selected)`}</button>
    </div>
    {!visibleBookmarks.length && <p>No saved questions match these filters.</p>}
    {visibleBookmarks.map(item => <article className="learning-saved-question" key={item.questionId}><label><input type="checkbox" aria-label={`Select question: ${item.question.text}`} checked={selectedBookmarkIds.includes(item.questionId)} onChange={event => setSelectedBookmarkIds(current => event.target.checked ? [...new Set([...current, item.questionId])] : current.filter(id => id !== item.questionId))} /> <strong>{item.question.text}</strong></label><span>{item.quiz.category?.name || 'Quiz'} · {item.quiz.difficulty} · {item.quiz.title}</span><div><button className="button button-quiet" onClick={() => onQuiz?.(item.quizId)}>Open quiz</button><button className="button button-quiet" onClick={async () => { try { await request(`/bookmarks/${item.questionId}`, { method: 'DELETE' }); setQuestionBookmarks(current => current.filter(bookmark => bookmark.questionId !== item.questionId)); setSelectedBookmarkIds(current => current.filter(id => id !== item.questionId)) } catch (error) { setBookmarkError(`Could not remove saved question. ${error.message}`) } }}>Remove</button></div></article>)}
    <h3>Quiz Mistake Notebook</h3><p>Missed and skipped questions are saved from your server-graded attempts, with repeats counted. Your practice does not change the original score.</p>
    {historyError && <p role="alert">{historyError} <button className="button button-quiet" onClick={() => setRetry(value => value + 1)}>Retry history</button></p>}
    <div className="learning-filters">
      <label>Subject<select value={subjectFilter} onChange={event => setSubjectFilter(event.target.value)}><option value="all">All subjects</option>{subjects.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Topic<select value={topicFilter} onChange={event => setTopicFilter(event.target.value)}><option value="all">All topics</option>{topics.map(value => <option key={value}>{value}</option>)}</select></label>
      <label>Difficulty<select value={difficultyFilter} onChange={event => setDifficultyFilter(event.target.value)}><option value="all">All difficulties</option>{difficulties.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <label><input type="checkbox" checked={showResolved} onChange={event => setShowResolved(event.target.checked)} /> Include resolved mistakes</label>
    {!mistakes.length && <p>No quiz mistakes to review yet.</p>}
    {mistakes.map(row => <QuizMistake key={row.id} row={row} onResolved={() => dispatch('review', { key: row.id })} onRemove={() => dispatch('remove-mistake', { key: row.id })} />)}
  </section>
}
function QuizMistake({ row, onResolved, onRemove }) {
  const [selected, setSelected] = useState(''), [checked, setChecked] = useState(false)
  const correct = row.question.options[row.question.correctAnswer]
  return <details className="learning-mistake"><summary>{row.title} · {row.question.text} · missed {row.mistakeCount || 1} time(s) {row.resolved && '✓ Resolved'}</summary><p>Your previous answer: {row.selectedOption || 'Skipped'}</p><fieldset><legend>Try again</legend>{row.question.options.map((option, i) => <label key={i}><input type="radio" name={`review-${row.id}`} checked={selected === option} onChange={() => { setSelected(option); setChecked(false) }} />{option}</label>)}</fieldset><button className="button button-primary" disabled={!selected} onClick={() => { setChecked(true); if (selected === correct) onResolved() }}>Check answer</button><button className="button button-quiet" onClick={onRemove}>Remove from notebook</button>{checked && <div role="status"><p>{selected === correct ? 'Correct. Mistake resolved!' : `Try again. Correct answer: ${correct}`}</p><p>{row.question.explanation || 'No explanation was provided for this question.'}</p></div>}<details><summary>Show answer and explanation</summary><p>{correct}</p><p>{row.question.explanation || 'No explanation was provided for this question.'}</p></details></details>
}
