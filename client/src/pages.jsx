import { useEffect, useRef, useState } from 'react'
import {
  Activity, ArrowLeft, ArrowRight, Award, BookOpenCheck, Check, CheckCircle2,
  ChevronDown, Clock3, Flame, Flag, LockKeyhole, LogIn, Medal, Search,
  Shield, Sparkles, Target, Trophy, UserRound, UsersRound, XCircle,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { demoLeaderboard } from './data/demoData.js'
import { Badge, CategoryIcon, EmptyState, QuizCard, StatCard } from './components/ui.jsx'
import { Pencil, Trash2 } from 'lucide-react'
import { shuffleQuestionOptions } from './utils/shuffle.js'
import { authValidationError } from './utils/authValidation.js'

const chartColors = ['#df7254', '#367f76', '#d7a740', '#678bb8', '#4a865f', '#aa789b', '#d58c57']
const initials = name => (name || '?').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase()
const percent = value => `${Math.round(value || 0)}%`

export function HomePage({ categories, quizzes, stats, user, onExplore, onStart, onRegister, onLeaderboard }) {
  const featured = quizzes.filter(quiz => quiz.featured).slice(0, 3)
  const firstQuiz = featured[0] || quizzes[0]
  const majorCategories = categories.filter(category => !category.parentSlug).slice(0, 10)
  return (
    <main>
      <section className="hero-section page-width">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow"><span className="live-dot" /> Practice that moves you forward</p>
          <h1>A little curiosity<br /><span>goes a long way.</span></h1>
          <p className="hero-description">Pick a subject, take a few minutes, and leave knowing something new. Every small win adds up.</p>
          <div className="hero-actions">
            <button className="button button-primary button-large" disabled={!firstQuiz} onClick={() => firstQuiz && onStart(firstQuiz)}>Start a quiz <ArrowRight size={17} /></button>
            <button className="button button-outline button-large" onClick={onExplore}>Browse subjects</button>
          </div>
          <button className="text-button hero-leaderboard-link" onClick={onLeaderboard}><Trophy size={15} /> See how other learners are doing</button>
          <div className="hero-trust"><div className="avatar-stack"><span className="avatar avatar-a">J</span><span className="avatar avatar-b">M</span><span className="avatar avatar-c">A</span><span className="avatar avatar-plus">+</span></div><p><strong>{stats.users ? `${stats.users.toLocaleString()} learners` : 'A growing learning space'}</strong><br /><span>show up curious, leave sharper</span></p></div>
        </div>
        <div className="hero-art" aria-label="A preview of a quiz question and progress">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <div className="hero-float float-one"><span><Flame size={15} /></span><div><strong>On a roll</strong><small>3-day learning streak</small></div></div>
          <div className="hero-quiz-preview">
            <div className="preview-top"><span className="preview-icon"><CategoryIcon name="code-2" /></span><span className="preview-timer"><Clock3 size={13} /> 00:24</span></div>
            <p className="eyebrow">JAVASCRIPT · QUESTION 04</p>
            <h2>Which method returns a new array?</h2>
            <div className="preview-choice preview-choice-selected"><span>A</span> map()<Check size={15} /></div>
            <div className="preview-choice"><span>B</span> forEach()</div>
            <div className="preview-progress"><i /></div>
            <div className="preview-foot"><span>4 of 8 questions</span><span>50%</span></div>
          </div>
          <div className="hero-float float-two"><span><Target size={16} /></span><div><strong>Quick progress</strong><small>+12% this week</small></div></div>
        </div>
        <div className="hero-noise" />
      </section>

      <section className="stat-strip page-width" aria-label="Platform statistics">
        <div><strong>{stats.quizzes}</strong><span>focused quizzes</span></div>
        <div><strong>{stats.questions.toLocaleString()}</strong><span>practice questions</span></div>
        <div><strong>{stats.categories}</strong><span>learning paths</span></div>
        <div><strong>3</strong><span>difficulty levels</span></div>
      </section>

      <section className="section-block page-width">
        <div className="section-heading"><div><p className="eyebrow">A good place to begin</p><h2>Picked for a curious mind</h2><p className="muted">Short sessions with a useful takeaway at the end.</p></div><button className="text-button" onClick={onExplore}>Browse all quizzes <ArrowRight size={16} /></button></div>
        {featured.length ? <div className="quiz-grid">{featured.map(quiz => <QuizCard key={quiz._id} quiz={quiz} onStart={onStart} />)}</div> : <EmptyState title="Your next quiz is on its way" detail="Explore all available topics and find a good place to start." />}
      </section>

      <section className="category-section">
        <div className="page-width section-block category-inner">
          <div className="section-heading"><div><p className="eyebrow">Learn your way</p><h2>Find your subject</h2></div><button className="text-button" onClick={onExplore}>All topics <ArrowRight size={16} /></button></div>
          <div className="category-grid">{majorCategories.map(category => <button className="category-tile" key={category._id || category.slug} onClick={() => onExplore(category.slug)}>
            <span className="category-mark" style={{ '--category-color': category.color || 'var(--accent)' }}><CategoryIcon name={category.icon} size={19} /></span>
            <span><strong>{category.name}</strong><small>{categories.filter(item => item.parentSlug === category.slug).length} subjects · {category.quizCount ?? 0} quizzes</small></span><ArrowRight size={16} className="category-arrow" />
          </button>)}</div>
        </div>
      </section>

      {!user && <section className="closing-cta page-width"><div className="closing-glyph"><Sparkles size={21} /></div><div><p className="eyebrow">Your next good habit</p><h2>Make room for one more thing you know.</h2><p className="muted">Keep your progress, revisit results, and see what you are getting better at.</p></div><button className="button button-primary" onClick={onRegister}>Create a free account <ArrowRight size={16} /></button></section>}
      <footer className="site-footer page-width"><span>quizly<span className="brand-period">.</span> <span className="muted">Practice with purpose.</span></span><span className="muted">Built for curious people.</span></footer>
    </main>
  )
}

export function ExplorePage({ quizzes, categories, onStart, initialCategory = 'all' }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(initialCategory)
  const [difficulty, setDifficulty] = useState('all')
  const [sort, setSort] = useState('newest')
  const [showFeatured, setShowFeatured] = useState(true)
  const categoryBySlug = new Map(categories.map(item => [item.slug, item]))
  const matchesCategory = quiz => category === 'all'
    || quiz.category?.slug === category
    || quiz.category?.rootSlug === category
    || categories.some(item => item.slug === quiz.category?.slug && item.parentSlug === category)
  const availableDifficulties = ['Easy', 'Medium', 'Hard'].filter(level => quizzes.some(quiz => matchesCategory(quiz) && quiz.difficulty === level))
  const selectCategory = slug => {
    setCategory(slug)
    setDifficulty('all')
  }
  const hasFilters = Boolean(search.trim()) || category !== 'all' || difficulty !== 'all'
  const filtered = quizzes.filter(quiz => {
    const query = search.trim().toLowerCase()
    const categoryName = quiz.category?.name || ''
    const rootName = categoryBySlug.get(quiz.category?.rootSlug)?.name || ''
    return (!query || `${quiz.title} ${quiz.description} ${categoryName} ${rootName}`.toLowerCase().includes(query))
      && matchesCategory(quiz)
      && (difficulty === 'all' || quiz.difficulty === difficulty)
  }).sort((a, b) => sort === 'popular'
    ? (b.attemptsCount || 0) - (a.attemptsCount || 0)
    : new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
  const featured = filtered.filter(quiz => quiz.featured)
  const showFeaturedSection = featured.length > 0 && !hasFilters
  const remaining = showFeaturedSection && showFeatured ? filtered.filter(quiz => !quiz.featured) : filtered
  return (
    <main className="page-width page-main">
      <div className="page-title-row"><div><p className="eyebrow">The quiz library</p><h1>Explore quizzes</h1><p className="muted">Find a focused session for what you want to learn next.</p></div><span className="count-note">{filtered.length} {filtered.length === 1 ? 'quiz' : 'quizzes'}</span></div>
      <div className="explore-tools">
        <label className="search-field"><Search size={18} /><span className="sr-only">Search quizzes</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search subjects, skills, or quiz names" /></label>
        <label className="select-field"><span className="sr-only">Sort quizzes</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="newest">Newest first</option><option value="popular">Most popular</option></select><ChevronDown size={15} /></label>
      </div>
      <div className="filter-layout">
        <aside className="filter-panel">
          <div className="filter-section"><p className="filter-title">Subjects</p><button className={`filter-option ${category === 'all' ? 'filter-active' : ''}`} onClick={() => selectCategory('all')}><span>All subjects</span><span>{quizzes.length}</span></button>
            {categories.filter(item => !item.parentSlug).map(subject => {
              const children = categories.filter(item => item.parentSlug === subject.slug)
              const expanded = category === subject.slug || categories.some(item => item.rootSlug === subject.slug && (item.slug === category || item.parentSlug === category))
              return <details className="subject-filter" key={subject.slug} open={expanded}>
                <summary className="subject-filter-summary"><span className="filter-category"><CategoryIcon name={subject.icon} size={15} style={{ color: subject.color }} /> {subject.name}</span><span>{subject.quizCount ?? 0}</span></summary>
                <button className={`filter-option subject-filter-all ${category === subject.slug ? 'filter-active' : ''}`} onClick={() => selectCategory(subject.slug)}>All {subject.name}<span>{subject.quizCount ?? 0}</span></button>
                {children.map(child => {
                  const nested = categories.filter(item => item.parentSlug === child.slug)
                  return <div className="subject-filter-branch" key={child.slug}>
                    <button className={`filter-option ${category === child.slug ? 'filter-active' : ''}`} onClick={() => selectCategory(child.slug)}><span>{child.name}</span><span>{child.quizCount ?? 0}</span></button>
                    {nested.map(item => <button className={`filter-option subject-filter-nested ${category === item.slug ? 'filter-active' : ''}`} key={item.slug} onClick={() => selectCategory(item.slug)}><span>{item.name}</span><span>{item.quizCount ?? 0}</span></button>)}
                  </div>
                })}
              </details>
            })}
          </div>
          <div className="filter-section"><p className="filter-title">Difficulty</p><div className="difficulty-filter">{['all', ...availableDifficulties].map(item => <button key={item} className={`difficulty-pill ${difficulty === item ? 'difficulty-active' : ''}`} onClick={() => setDifficulty(item)}>{item === 'all' ? 'Any level' : item}</button>)}</div></div>
        </aside>
        <div className="explore-results">
          {showFeaturedSection && <div className="results-group"><div className="results-group-heading"><div><p className="eyebrow">Editor’s selection</p><h2>Featured</h2></div><button className="text-button" onClick={() => setShowFeatured(!showFeatured)}>{showFeatured ? 'Hide featured' : 'Show featured'}</button></div>{showFeatured && <div className="quiz-grid">{featured.map(quiz => <QuizCard key={quiz._id} quiz={quiz} onStart={onStart} />)}</div>}</div>}
          <div className="results-group"><div className="results-group-heading"><div><p className="eyebrow">Keep exploring</p><h2>{category === 'all' ? 'All quizzes' : categories.find(item => item.slug === category)?.name}</h2></div></div>
            {remaining.length ? <div className="quiz-grid">{remaining.map(quiz => <QuizCard key={quiz._id} quiz={quiz} onStart={onStart} />)}</div> : (showFeaturedSection && showFeatured ? null : <EmptyState title="No quizzes match those filters" detail="Try another topic or clear the difficulty filter." action={<button className="button button-quiet" onClick={() => { setSearch(''); setCategory('all'); setDifficulty('all') }}>Clear filters</button>} />)}
          </div>
        </div>
      </div>
    </main>
  )
}

export function QuizPage({ quiz, onExit, onComplete }) {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [marked, setMarked] = useState([])
  const [remaining, setRemaining] = useState((quiz?.timeLimit || 1) * 60)
  const [confirm, setConfirm] = useState(false)
  const submitted = useRef(false)
  const questions = quiz?.questions || []
  const question = questions[current]
  const [loadedQuestions, setLoadedQuestions] = useState(() => {
    const firstQuestion = questions[0]
    if (!firstQuestion) return {}
    const firstQuestionId = firstQuestion.id || firstQuestion._id
    return { [firstQuestionId]: shuffleQuestionOptions(firstQuestion) }
  })
  const currentId = question?.id || question?._id
  const loadedQuestion = currentId ? loadedQuestions[currentId] || question : question
  const elapsed = (quiz?.timeLimit || 1) * 60 - remaining
  const answeredCount = Object.values(answers).filter(Boolean).length
  const formatTime = seconds => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`

  useEffect(() => {
    setCurrent(0)
    setAnswers({})
    setMarked([])
    setRemaining((quiz?.timeLimit || 1) * 60)
    setConfirm(false)
    submitted.current = false
  }, [quiz?._id])

  useEffect(() => {
    if (!quiz || !questions.length || submitted.current) return undefined
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [quiz?._id, questions.length])

  const finish = () => {
    if (submitted.current) return
    submitted.current = true
    setConfirm(false)
    onComplete(quiz, { answers, markedQuestionIds: marked, timeTaken: elapsed })
  }

  useEffect(() => {
    if (remaining === 0 && !submitted.current) finish()
  }, [remaining])

  if (!quiz || !question) return <main className="page-width page-main"><EmptyState title="That quiz is unavailable" detail="Choose another quiz from the library." action={<button className="button button-primary" onClick={onExit}>Browse quizzes</button>} /></main>
  const goToQuestion = nextIndex => {
    const nextQuestion = questions[nextIndex]
    const nextQuestionId = nextQuestion.id || nextQuestion._id
    setLoadedQuestions(existing => existing[nextQuestionId]
      ? existing
      : { ...existing, [nextQuestionId]: shuffleQuestionOptions(nextQuestion) })
    setCurrent(nextIndex)
  }
  const isMarked = marked.includes(currentId)
  const answered = Boolean(answers[currentId])
  const answeredQuestions = Object.keys(answers).length
  const unanswered = questions.length - answeredQuestions
  const isLow = remaining <= 30

  return (
    <main className="quiz-shell page-width">
      <div className="quiz-topbar"><button className="back-link" onClick={onExit}><ArrowLeft size={16} /> Exit quiz</button><div className="quiz-title-block"><span className="eyebrow">{quiz.category?.name} · {quiz.difficulty}</span><h1>{quiz.title}</h1></div><div className={`timer-chip ${isLow ? 'timer-low' : ''}`} aria-live="polite"><Clock3 size={16} /><span>{formatTime(remaining)}</span></div></div>
      <div className="quiz-progress-row"><span>Question {current + 1} <span className="muted">of {questions.length}</span></span><span>{Math.round(((current + 1) / questions.length) * 100)}% complete</span></div>
      <div className="progress-track"><span style={{ width: `${((current + 1) / questions.length) * 100}%` }} /></div>
      <div className="quiz-layout">
        <section className="question-column">
          <article className="question-panel">
            <div className="question-panel-top"><span className="question-index">{String(current + 1).padStart(2, '0')}</span><button className={`review-toggle ${isMarked ? 'review-active' : ''}`} aria-pressed={isMarked} onClick={() => setMarked(list => isMarked ? list.filter(id => id !== currentId) : [...list, currentId])}><Flag size={15} /> {isMarked ? 'Marked for review' : 'Mark for review'}</button></div>
            <p className="eyebrow">Choose one answer</p><h2>{question.text}</h2>
            <div className="answer-list" role="group" aria-label="Answer options">{loadedQuestion.options.map((option, index) => {
              const selected = answers[currentId] === option
              const canReviewAnswer = Boolean(answers[currentId]) && Number.isInteger(loadedQuestion.correctAnswer)
              const isCorrect = canReviewAnswer && index === loadedQuestion.correctAnswer
              const isIncorrect = canReviewAnswer && selected && !isCorrect
              return <button key={`${currentId}-${index}`} aria-pressed={selected} className={`answer-option ${selected ? 'answer-selected' : ''} ${isCorrect ? 'answer-correct' : ''} ${isIncorrect ? 'answer-incorrect' : ''}`} onClick={() => setAnswers(value => ({ ...value, [currentId]: option }))}>
                <span className="answer-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span>{selected && <CheckCircle2 size={18} className="answer-check" />}
              </button>
            })}</div>
          </article>
          <div className="quiz-navigation"><button className="button button-quiet" disabled={current === 0} onClick={() => goToQuestion(Math.max(0, current - 1))}><ArrowLeft size={16} /> Previous</button><div className="quiz-nav-right"><span className="muted">{answered ? 'Answer saved' : 'Not answered'}</span>{current < questions.length - 1 ? <button className="button button-primary" onClick={() => goToQuestion(Math.min(questions.length - 1, current + 1))}>Next question <ArrowRight size={16} /></button> : <button className="button button-primary" onClick={() => setConfirm(true)}>Review & submit <Check size={16} /></button>}</div></div>
        </section>
        <aside className="question-map-panel"><div className="map-header"><div><p className="eyebrow">Your progress</p><h2>Question map</h2></div><span className="map-count">{answeredCount}/{questions.length}</span></div><div className="map-legend"><span><i className="legend-answered" /> Answered</span><span><i className="legend-marked" /> Review</span></div><div className="question-map">{questions.map((item, index) => {
          const id = item.id || item._id
          return <button key={id} aria-label={`Go to question ${index + 1}${answers[id] ? ', answered' : ', unanswered'}${marked.includes(id) ? ', marked for review' : ''}`} aria-current={index === current ? 'step' : undefined} className={`map-number ${index === current ? 'map-current' : ''} ${answers[id] ? 'map-answered' : ''} ${marked.includes(id) ? 'map-marked' : ''}`} onClick={() => goToQuestion(index)}>{index + 1}</button>
        })}</div><div className="map-summary"><div><span className="map-summary-dot summary-done" /> <span>Answered</span><strong>{answeredCount}</strong></div><div><span className="map-summary-dot summary-open" /> <span>Unanswered</span><strong>{unanswered}</strong></div><div><span className="map-summary-dot summary-review" /> <span>For review</span><strong>{marked.length}</strong></div></div><button className="button button-submit-wide" onClick={() => setConfirm(true)}>Submit quiz <ArrowRight size={16} /></button></aside>
      </div>
      {isLow && <p className="timer-warning" role="status"><Clock3 size={15} /> Less than 30 seconds remaining. Your quiz submits automatically at zero.</p>}
      {confirm && <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setConfirm(false)}><section className="modal-panel submission-modal" role="dialog" aria-modal="true" aria-labelledby="submit-title"><button className="icon-button modal-close" aria-label="Close dialog" onClick={() => setConfirm(false)}><ArrowRight size={18} /></button><span className="modal-symbol"><Check size={20} /></span><p className="eyebrow">Review submission</p><h2 id="submit-title">Ready to see how you did?</h2><p className="muted">You can still go back and change your answers before submitting.</p><div className="submission-summary"><div><span>Answered</span><strong>{answeredCount}</strong></div><div><span>Unanswered</span><strong>{unanswered}</strong></div><div><span>For review</span><strong>{marked.length}</strong></div></div>{unanswered > 0 && <p className="submission-note">You have {unanswered} unanswered {unanswered === 1 ? 'question' : 'questions'}.</p>}<div className="modal-actions"><button className="button button-quiet" onClick={() => setConfirm(false)}>Keep working</button><button className="button button-primary" onClick={finish}>Submit quiz <ArrowRight size={16} /></button></div></section></div>}
    </main>
  )
}

function resultAnswers(attempt) {
  return (attempt?.answers || []).map(item => ({
    question: typeof item.question === 'object' ? item.question : item.questionSnapshot || item.questionData,
    selectedOption: item.selectedOption || '',
  })).filter(item => item.question)
}

export function ResultPage({ attempt, onTryAgain, onExplore, onDashboard }) {
  const [showReview, setShowReview] = useState(true)
  if (!attempt) return <main className="page-width page-main"><EmptyState title="No result selected" detail="Complete a quiz to see your results here." action={<button className="button button-primary" onClick={onExplore}>Explore quizzes</button>} /></main>
  const rows = resultAnswers(attempt)
  const correct = attempt.correctCount ?? attempt.score ?? 0
  const incorrect = attempt.incorrectCount ?? Math.max(0, rows.filter(row => row.selectedOption).length - correct)
  const unanswered = attempt.unansweredCount ?? Math.max(0, rows.length - correct - incorrect)
  const scoreData = [{ name: 'Correct', value: correct, fill: '#59c995' }, { name: 'Incorrect', value: incorrect, fill: '#f07878' }, { name: 'Unanswered', value: unanswered, fill: '#f0bd64' }]
  const chartData = [{ name: 'Correct', value: correct }, { name: 'Incorrect', value: incorrect }, { name: 'Unanswered', value: unanswered }]
  const quiz = attempt.quiz || attempt.quizSnapshot || {}
  const duration = attempt.timeTaken || 0
  return (
    <main className="page-width page-main result-page">
      <div className="result-heading"><span className={`result-status ${attempt.passed ? 'status-pass' : 'status-try'}`}>{attempt.passed ? <CheckCircle2 size={16} /> : <Activity size={16} />}{attempt.passed ? 'Strong work' : 'Keep building'}</span><p className="eyebrow">Your session is complete</p><h1>Quiz complete<span className="brand-period">.</span></h1><p className="muted">A clear picture of what clicked and where to focus next.</p></div>
      <section className="score-hero"><div className="score-ring" style={{ '--score': `${attempt.percentage || 0}%` }}><div><strong>{attempt.percentage || 0}<small>%</small></strong><span>accuracy</span></div></div><div className="score-story"><p className="eyebrow">{quiz.category?.name || 'Quiz result'} · {quiz.difficulty || ''}</p><h2>{quiz.title || 'Quiz result'}</h2><p className="muted">{attempt.passed ? 'You reached the 60% pass mark. Keep your momentum going.' : 'Every result is a useful baseline. Review a few questions and try again.'}</p><div className="score-actions"><button className="button button-primary" onClick={onTryAgain}>Try again <ArrowRight size={16} /></button><button className="button button-outline" onClick={() => document.getElementById('question-review')?.scrollIntoView({ behavior: 'smooth' })}><BookOpenCheck size={15} /> Review answers</button><button className="button button-quiet" onClick={onDashboard}>Open dashboard</button></div></div><div className="score-total"><span>Total score</span><strong>{correct}<i>/{rows.length || quiz.totalQuestions || 0}</i></strong><span>{attempt.passed ? 'Pass' : 'Not passed yet'}</span></div></section>
      <div className="stats-grid result-stats"><StatCard icon={CheckCircle2} label="Correct" value={correct} detail="Well remembered" accent="green" /><StatCard icon={XCircle} label="Incorrect" value={incorrect} detail="Worth revisiting" accent="rose" /><StatCard icon={CircleHelpIcon} label="Unanswered" value={unanswered} detail="Could be a next step" accent="amber" /><StatCard icon={Clock3} label="Time taken" value={`${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`} detail="Minutes : seconds" accent="blue" /></div>
      <section className="result-analysis"><div className="chart-panel result-chart"><div className="panel-heading"><div><p className="eyebrow">At a glance</p><h2>Answer breakdown</h2></div></div><div className="result-chart-body"><div className="result-donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={chartData} dataKey="value" innerRadius="68%" outerRadius="88%" paddingAngle={4} stroke="none">{scoreData.map(item => <Cell key={item.name} fill={item.fill} />)}</Pie><Tooltip contentStyle={{ background: '#fffdf8', border: '1px solid #e8e1d4', borderRadius: 12, color: '#263a36' }} /></PieChart></ResponsiveContainer><div><strong>{attempt.percentage || 0}%</strong><span>correct</span></div></div><div className="breakdown-legend">{scoreData.map(item => <div key={item.name}><span><i style={{ background: item.fill }} />{item.name}</span><strong>{item.value}</strong></div>)}</div></div></div><div className="chart-panel category-insight"><div className="panel-heading"><div><p className="eyebrow">Keep learning</p><h2>What to revisit</h2></div><span className="insight-icon"><BookOpenCheck size={18} /></span></div><p className="muted">{incorrect + unanswered ? `${incorrect + unanswered} question${incorrect + unanswered === 1 ? '' : 's'} to revisit can help turn this into a stronger result.` : 'A perfect round. Try a harder quiz to keep stretching your knowledge.'}</p><div className="insight-meter"><span style={{ width: `${attempt.percentage || 0}%` }} /></div><div className="insight-meta"><span>Session accuracy</span><strong>{attempt.percentage || 0}%</strong></div><button className="text-button" onClick={onExplore}>Find another quiz <ArrowRight size={15} /></button></div></section>
      <section id="question-review" className="review-section"><div className="section-heading review-heading"><div><p className="eyebrow">Learn from the details</p><h2>Question review</h2></div><button className="button button-quiet" onClick={() => setShowReview(value => !value)}>{showReview ? 'Hide review' : 'Show review'} <ChevronDown className={showReview ? 'rotate-chevron' : ''} size={16} /></button></div>{showReview && <div className="review-list">{rows.map((row, index) => {
        const question = row.question
        const answerIndex = question.options?.indexOf(row.selectedOption) ?? -1
        const right = answerIndex === question.correctAnswer
        return <article key={question.id || question._id || index} className="review-item"><div className="review-item-head"><span className="review-question-number">{String(index + 1).padStart(2, '0')}</span><h3>{question.text}</h3><Badge tone={!row.selectedOption ? 'warning' : right ? 'success' : 'error'}>{!row.selectedOption ? 'Skipped' : right ? 'Correct' : 'Review'}</Badge></div><div className="review-answer-grid"><div className={`review-answer ${right ? 'review-answer-correct' : 'review-answer-muted'}`}><span>Your answer</span><strong>{row.selectedOption || 'No answer selected'}</strong></div><div className="review-answer review-answer-correct"><span>Correct answer</span><strong>{question.options?.[question.correctAnswer] || 'Not available'}</strong></div></div>{question.explanation && <p className="review-explanation"><Sparkles size={14} /> {question.explanation}</p>}</article>
      })}</div>}</section>
      <div className="result-bottom-actions"><button className="button button-quiet" onClick={onExplore}>Back to quizzes <ArrowLeft size={16} /></button><button className="button button-primary" onClick={onTryAgain}>Try again <ArrowRight size={16} /></button></div>
    </main>
  )
}

function CircleHelpIcon(props) {
  return <Activity {...props} />
}

export function DashboardPage({ user, data, loading, onOpenAttempt, onExplore }) {
  if (loading) return <main className="page-width page-main"><div className="dashboard-loading"><div className="skeleton-line" /><div className="skeleton-grid">{[1, 2, 3, 4].map(item => <div className="skeleton-card" key={item} />)}</div></div></main>
  const stats = data?.stats || {}
  const attempts = data?.recentAttempts || []
  const achievementList = data?.achievements || []
  return (
    <main className="page-width page-main">
      <div className="dashboard-greeting"><div><p className="eyebrow">Your learning, in one place</p><h1>Welcome back, {user?.name?.split(' ')[0] || 'there'}<span className="brand-period">.</span></h1><p className="muted">A little progress still counts as progress.</p></div><button className="button button-primary" onClick={onExplore}>Find a quiz <ArrowRight size={16} /></button></div>
      <div className="stats-grid dashboard-stats"><StatCard icon={BookOpenCheck} label="Quizzes completed" value={stats.quizzesCompleted || 0} detail="Your completed sessions" accent="violet" /><StatCard icon={Target} label="Average score" value={percent(stats.averageScore)} detail="Across all attempts" accent="cyan" /><StatCard icon={Award} label="Best score" value={percent(stats.bestScore)} detail="Your personal best" accent="amber" /><StatCard icon={CheckCircle2} label="Correct answers" value={stats.totalCorrect || 0} detail="Knowledge in the bank" accent="green" /></div>
      <div className="dashboard-charts"><section className="chart-panel chart-wide"><div className="panel-heading"><div><p className="eyebrow">Your consistency</p><h2>Score over time</h2></div><span className="chart-legend"><i /> Accuracy</span></div>{data?.scoreHistory?.length ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data.scoreHistory} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}><defs><linearGradient id="scoreGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#9684ff" stopOpacity={0.28} /><stop offset="95%" stopColor="#9684ff" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#292b38" vertical={false} /><XAxis dataKey="date" tickFormatter={date => new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} tickLine={false} axisLine={false} tick={{ fill: '#898b9c', fontSize: 11 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#898b9c', fontSize: 11 }} tickFormatter={value => `${value}%`} /><Tooltip contentStyle={{ background: '#181a25', border: '1px solid #2c2f3d', borderRadius: 12, color: '#f6f4ff' }} labelFormatter={date => new Date(date).toLocaleDateString()} formatter={value => [`${value}%`, 'Score']} /><Area type="monotone" dataKey="score" stroke="#a393ff" strokeWidth={2.5} fill="url(#scoreGradient)" activeDot={{ r: 5, fill: '#c0b4ff', stroke: '#11121a', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div> : <div className="chart-empty"><Activity size={20} /><span>Complete a quiz to start your score history.</span></div>}</section>
        <section className="chart-panel chart-small"><div className="panel-heading"><div><p className="eyebrow">Where you practice</p><h2>By category</h2></div></div>{data?.categoryPerformance?.length ? <div className="chart-wrap chart-wrap-small"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.categoryPerformance} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 6 }}><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} tick={{ fill: '#aaaabd', fontSize: 11 }} /><Tooltip contentStyle={{ background: '#181a25', border: '1px solid #2c2f3d', borderRadius: 12, color: '#f6f4ff' }} formatter={value => [`${value}%`, 'Average']} /><Bar dataKey="score" radius={[0, 5, 5, 0]} barSize={12}>{data.categoryPerformance.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="chart-empty">No category scores yet.</div>}</section>
        <section className="chart-panel chart-small"><div className="panel-heading"><div><p className="eyebrow">Stretch your range</p><h2>By difficulty</h2></div></div>{data?.difficultyPerformance?.length ? <div className="chart-wrap chart-wrap-small"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.difficultyPerformance} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 8 }}><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={72} tickLine={false} axisLine={false} tick={{ fill: '#aaaabd', fontSize: 11 }} /><Tooltip contentStyle={{ background: '#181a25', border: '1px solid #2c2f3d', borderRadius: 12, color: '#f6f4ff' }} formatter={value => [`${value}%`, 'Average']} /><Bar dataKey="score" radius={[0, 5, 5, 0]} barSize={15}>{data.difficultyPerformance.map((item, index) => <Cell key={item.name} fill={chartColors[index + 2]} />)}</Bar></BarChart></ResponsiveContainer></div> : <div className="chart-empty">Complete quizzes at different levels to compare scores.</div>}</section></div>
      <div className="dashboard-lower"><section className="panel-surface recent-panel"><div className="panel-heading"><div><p className="eyebrow">Your last sessions</p><h2>Recent quizzes</h2></div><span className="count-note">{attempts.length} recent</span></div>{attempts.length ? <div className="recent-list">{attempts.slice(0, 6).map((attempt, index) => <button className="recent-row" key={attempt._id || `${attempt.quiz?._id}-${attempt.createdAt}-${index}`} onClick={() => onOpenAttempt(attempt)}><span className="recent-icon"><CategoryIcon name={attempt.quiz?.category?.icon || 'book'} /></span><span className="recent-quiz-name"><strong>{attempt.quiz?.title || attempt.quiz?.name || 'Quiz session'}</strong><small>{attempt.quiz?.category?.name || 'Practice'} · {new Date(attempt.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></span><span className="recent-score"><strong>{attempt.percentage}%</strong><small>{attempt.score}/{attempt.quiz?.totalQuestions || attempt.answers?.length || 0}</small></span><ArrowRight size={15} className="recent-arrow" /></button>)}</div> : <EmptyState icon={BookOpenCheck} title="Your story starts with one quiz" detail="Complete a quiz and your result will show up here." action={<button className="button button-quiet" onClick={onExplore}>Explore quizzes</button>} />}</section>
        <section className="panel-surface achievement-panel"><div className="panel-heading"><div><p className="eyebrow">Small wins matter</p><h2>Achievements</h2></div><span className="achievement-total"><Trophy size={15} /> {achievementList.filter(item => item.earned).length}/{achievementList.length}</span></div><div className="achievement-list">{achievementList.slice(0, 6).map(item => <article className={`achievement-row ${item.earned ? 'achievement-earned' : ''}`} key={item.code}><span className="achievement-mark">{item.earned ? <Medal size={17} /> : <LockKeyhole size={15} />}</span><div className="achievement-copy"><strong>{item.title}</strong><small>{item.detail}</small><div className="achievement-progress"><span style={{ width: `${item.progress}%` }} /></div></div><span className="achievement-percent">{item.earned ? <Check size={14} /> : `${item.progress}%`}</span></article>)}</div></section></div>
    </main>
  )
}

export function LeaderboardPage({ categories, onCategoryChange, category, entries, currentUser, isOffline }) {
  const rows = entries?.length ? entries : isOffline ? demoLeaderboard : []
  const podium = rows.slice(0, 3)
  const standings = rows.slice(3)
  return (
    <main className="page-width page-main leaderboard-page"><div className="page-title-row"><div><p className="eyebrow">{isOffline ? 'Local demo preview' : 'A little friendly momentum'}</p><h1>Leaderboard</h1><p className="muted">Recognizing the practice, not just the perfect scores.</p></div><label className="select-field leaderboard-select"><span className="sr-only">Filter leaderboard by category</span><select value={category} onChange={event => onCategoryChange(event.target.value)}><option value="">All categories</option>{categories.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select><ChevronDown size={15} /></label></div>
      {podium.length > 0 && <section className="leaderboard-podium" aria-label="Top three learners">{podium.map((entry, index) => <article className={`podium-card podium-place-${index + 1}`} key={`${entry.name}-${entry.date}-${index}`}><span className="podium-rank">{index === 0 ? <Trophy size={16} /> : <Medal size={16} />} {index + 1}{index === 0 ? 'st' : index === 1 ? 'nd' : 'rd'} place</span><span className={`avatar podium-avatar top-avatar top-avatar-${index + 1}`}>{initials(entry.name)}</span><strong className="podium-name">{entry.name}{entry.currentUser || entry.name === currentUser?.name ? <small className="you-label">You</small> : null}</strong><span className="podium-category">{entry.category}</span><span className="podium-score">{entry.percentage}%</span><span className="podium-quiz">{entry.quiz}</span></article>)}</section>}
      {(standings.length > 0 || podium.length === 0) && <section className="leaderboard-panel">{standings.length > 0 ? <><div className="leaderboard-head"><span>Rank</span><span>Learner</span><span>Quiz</span><span>Score</span><span>Date</span></div>{standings.map((entry, index) => <article key={`${entry.name}-${entry.date}-${index + 3}`} className={`leaderboard-row ${entry.currentUser || entry.name === currentUser?.name ? 'leaderboard-me' : ''}`}><span className="rank-cell"><span className="rank-number">{entry.rank || index + 4}</span></span><span className="leader-user"><span className="avatar">{initials(entry.name)}</span><span><strong>{entry.name}{entry.currentUser || entry.name === currentUser?.name ? <small className="you-label">You</small> : null}</strong><small>{entry.category}</small></span></span><span className="leader-quiz">{entry.quiz}</span><span className="leader-score"><strong>{entry.percentage}%</strong><small>{entry.score} correct</small></span><span className="leader-date">{new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></article>)}</> : <EmptyState icon={Trophy} title="The leaderboard is getting warmed up" detail="Complete a quiz to be the first name on the board." />}</section>}
      <div className="leaderboard-note"><UsersRound size={16} /><span>Only first names and quiz results are shown. Email addresses and private account details stay private.</span></div>
    </main>
  )
}

export function AuthPage({ mode, onModeChange, onSubmit, onContinueDemo }) {
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const register = mode === 'register'

  async function submit(event) {
    event.preventDefault()
    setError('')
    const validationError = authValidationError({ mode, name, identifier, password })
    if (validationError) return setError(validationError)
    setLoading(true)
    try {
      await onSubmit(register
        ? { name: name.trim(), email: identifier.trim(), password }
        : { identifier: identifier.trim(), password })
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page"><div className="auth-backdrop" /><div className="auth-wrap"><button className="back-link auth-back" onClick={() => onModeChange('#home')}><ArrowLeft size={16} /> Back to home</button><section className="auth-card"><div className="auth-illustration"><span className="auth-art-mark"><Sparkles size={19} /></span><p className="eyebrow">A few curious minutes</p><h2>Good things grow one question at a time.</h2><p>Make a little space for learning. The rest adds up.</p><div className="auth-sample"><span className="auth-sample-label"><CategoryIcon name="atom" size={15} /> TODAY'S LITTLE CHALLENGE</span><strong>What would you like to know next?</strong><div className="auth-sample-options"><i /><i /><i /></div><span className="auth-sample-foot"><Clock3 size={13} /> Just a few minutes</span></div></div><div className="auth-form-panel"><div className="auth-mark"><BookOpenCheck size={20} /></div><p className="eyebrow">{register ? 'Start your learning practice' : 'Welcome back'}</p><h1>{register ? 'Create your account' : 'Good to see you again.'}</h1><p className="muted">{register ? 'Save your quiz history and keep track of what is clicking.' : 'Sign in to pick up where your curiosity left off.'}</p>
      <form onSubmit={submit} className="auth-form" noValidate>
        {register && <label className="field-label">Your name<input autoComplete="name" required minLength={2} maxLength={60} value={name} onChange={event => setName(event.target.value)} placeholder="Jordan Lee" /></label>}
        <label className="field-label">{register ? 'Email address' : 'Email or username'}<input autoComplete={register ? 'email' : 'username'} required type={register ? 'email' : 'text'} value={identifier} onChange={event => setIdentifier(event.target.value)} placeholder={register ? 'you@example.com' : 'Email address or username'} /></label>
        <label className="field-label">Password<span className="password-field"><input autoComplete={register ? 'new-password' : 'current-password'} required minLength={8} type={visible ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /><button type="button" className="password-toggle" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(value => !value)}>{visible ? 'Hide' : 'Show'}</button></span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" type="submit" disabled={loading}>{loading ? <span className="button-spinner" /> : register ? 'Create account' : 'Sign in'} <ArrowRight size={16} /></button>
      </form>
      <p className="auth-switch">{register ? 'Already have an account?' : 'New to Quizly?'} <button onClick={() => onModeChange(register ? '#login' : '#register')}>{register ? 'Log in' : 'Create an account'}</button></p>
      <div className="auth-divider"><span>or</span></div><button className="button button-outline demo-button" onClick={onContinueDemo}><UserRound size={16} /> Continue with a demo profile</button><p className="auth-note"><Shield size={13} /> Your personal information stays private.</p>
      </div></section><p className="auth-footnote">Focused practice. Useful feedback. No noise.</p></div></main>
  )
}

export function AdminPage({ activeSection, categories, quizzes, stats, quizStats, users, loading, onSaveQuiz, onDeleteQuiz, onSaveCategory, onDeleteCategory, onLoadQuiz, onSaveQuestion, onDeleteQuestion, onChangeUserRole }) {
  const blankQuestion = () => ({ text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryError, setCategoryError] = useState('')
  const [userError, setUserError] = useState('')
  const visibleQuizzes = quizzes.filter(quiz => `${quiz.title} ${quiz.category?.name}`.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    const sectionIds = { dashboard: 'admin-overview', subjects: 'admin-categories', quizzes: 'admin-quizzes', questions: 'admin-questions', users: 'admin-users', statistics: 'admin-statistics' }
    document.getElementById(sectionIds[activeSection])?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeSection])

  async function openForm(quiz = null) {
    const fullQuiz = quiz ? await onLoadQuiz(quiz) : null
    setEditing(fullQuiz)
    setError('')
    setForm(fullQuiz ? {
      title: fullQuiz.title,
      description: fullQuiz.description || '',
      category: fullQuiz.category?._id || categories[0]?._id || '',
      difficulty: fullQuiz.difficulty,
      timeLimit: fullQuiz.timeLimit,
      featured: Boolean(fullQuiz.featured),
      questions: (fullQuiz.questions || []).map(question => ({ ...question, correctAnswer: question.correctAnswer ?? 0, options: [...question.options] })),
    } : { title: '', description: '', category: categories[0]?._id || '', difficulty: 'Easy', timeLimit: 8, featured: false, questions: [blankQuestion()] })
  }

  async function save(event) {
    event.preventDefault()
    setError('')
    if (!form.category) return setError('Create or select a category first.')
    if (!form.questions.length || form.questions.some(question => !question.text.trim() || question.options.some(option => !option.trim()))) return setError('Complete each question and all four answer options.')
    setSaving(true)
    try {
      await onSaveQuiz({ ...form, timeLimit: Number(form.timeLimit) }, editing)
      setForm(null)
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  function updateQuestion(questionIndex, update) {
    setForm(value => ({ ...value, questions: value.questions.map((question, index) => index === questionIndex ? { ...question, ...update } : question) }))
  }

  return (
    <main className="admin-layout page-width page-main"><aside className="admin-sidebar"><p className="eyebrow">Workspace</p><h2>Admin</h2><nav aria-label="Admin navigation"><button onClick={() => document.getElementById('admin-overview')?.scrollIntoView({ behavior: 'smooth' })}><Activity size={16} /> Overview</button><button className="admin-nav-active" onClick={() => document.getElementById('admin-quizzes')?.scrollIntoView({ behavior: 'smooth' })}><BookOpenCheck size={16} /> Quiz library</button><button onClick={() => document.getElementById('admin-categories')?.scrollIntoView({ behavior: 'smooth' })}><Layers3Icon /> Categories</button><button onClick={() => document.getElementById('admin-users')?.scrollIntoView({ behavior: 'smooth' })}><UsersRound size={16} /> Users & activity</button></nav><div className="admin-sidebar-note"><Shield size={15} /><span>Administrator access is active for this account.</span></div></aside>
      <section className={`admin-content admin-section-${activeSection || 'dashboard'}`}><div id="admin-overview" className="admin-page-heading"><div><p className="eyebrow">Platform overview</p><h1>{({ dashboard: 'Admin Dashboard', subjects: 'Manage Subjects', quizzes: 'Manage Quizzes', users: 'Manage Users', statistics: 'Statistics' })[activeSection] || 'Admin Dashboard'}</h1><p className="muted">A clear view of your content and community.</p></div>{activeSection === 'quizzes' && <button className="button button-primary" onClick={() => openForm()}><span>+</span> Create quiz</button>}</div>
      <div className="stats-grid admin-stats"><StatCard icon={UsersRound} label="Learners" value={stats?.users ?? '—'} detail="Registered accounts" accent="violet" /><StatCard icon={BookOpenCheck} label="Quizzes" value={stats?.quizzes ?? quizzes.length} detail="In the library" accent="cyan" /><StatCard icon={CircleQuestionIcon} label="Questions" value={stats?.questions ?? '—'} detail="Across all quizzes" accent="amber" /><StatCard icon={Activity} label="Attempts" value={stats?.attempts ?? '—'} detail={`${stats?.averageScore ?? 0}% average score`} accent="green" /></div>
      <section id="admin-quizzes" className="admin-table-panel"><div className="admin-table-heading"><div><p className="eyebrow">Content management</p><h2>Quiz library</h2></div><label className="search-field admin-search"><Search size={16} /><span className="sr-only">Search quizzes</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a quiz" /></label></div>
        <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Quiz</th><th>Category</th><th>Level</th><th>Questions</th><th>Actions</th></tr></thead><tbody>{visibleQuizzes.map(quiz => <tr key={quiz._id}><td><strong>{quiz.title}</strong><small>{quiz.description}</small></td><td>{quiz.category?.name}</td><td><Badge tone={quiz.difficulty?.toLowerCase()}>{quiz.difficulty}</Badge></td><td>{quiz.totalQuestions}</td><td><div className="table-actions"><button onClick={() => openForm(quiz)}>Edit</button><button className="table-delete" onClick={() => onDeleteQuiz(quiz)}>Delete</button></div></td></tr>)}</tbody></table>{!visibleQuizzes.length && <EmptyState title="No quizzes found" detail="Try a different search or create a quiz." />}</div>
      </section>
      <section id="admin-users" className="admin-table-panel"><div className="admin-table-heading"><div><p className="eyebrow">Community</p><h2>Registered users</h2></div><span className="count-note">{users.length} accounts</span></div>{userError && <p className="form-error" role="alert">{userError}</p>}<div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Attempts</th><th>Average score</th><th>Joined</th></tr></thead><tbody>{users.map(item => <tr key={item._id}><td><strong>{item.name}</strong></td><td>{item.email}</td><td><select aria-label={`Role for ${item.name}`} value={item.role} onChange={async event => { setUserError(''); try { await onChangeUserRole(item._id, event.target.value) } catch (roleError) { setUserError(roleError.message) } }}><option value="user">User</option><option value="admin">Admin</option></select></td><td>{item.attempts ?? 0}</td><td>{item.averageScore ?? 0}%</td><td>{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>{!users.length && <EmptyState title="No accounts to show" detail="Registered learners will appear here." />}</div></section>
      <section id="admin-attempts" className="admin-table-panel"><div className="admin-table-heading"><div><p className="eyebrow">Recent activity</p><h2>Quiz attempts</h2></div><span className="count-note">{stats?.attempts ?? '—'} total</span></div><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Learner</th><th>Quiz</th><th>Category</th><th>Result</th><th>Date</th></tr></thead><tbody>{(stats?.recentAttempts || []).map((item, index) => <tr key={`${item.user}-${item.createdAt}-${index}`}><td><strong>{item.user}</strong></td><td>{item.quiz}</td><td>{item.category || 'General'}</td><td>{item.percentage}% <small>({item.score} correct)</small></td><td>{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>{!stats?.recentAttempts?.length && <EmptyState title="No attempt activity yet" detail="Completed learner quizzes will appear here." />}</div></section>
      <section id="admin-statistics" className="admin-table-panel"><div className="admin-table-heading"><div><p className="eyebrow">Platform performance</p><h2>Quiz statistics</h2></div><span className="count-note">{quizStats.length} quizzes</span></div><div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Quiz</th><th>Subject</th><th>Level</th><th>Learners</th><th>Attempts</th><th>Average score</th></tr></thead><tbody>{quizStats.map(item => <tr key={item._id}><td><strong>{item.title}</strong></td><td>{item.category}</td><td>{item.difficulty}</td><td>{item.learners}</td><td>{item.attempts}</td><td>{item.averageScore}%</td></tr>)}</tbody></table>{!quizStats.length && <EmptyState title="No quiz statistics yet" detail="Quiz performance will appear here after learners submit quizzes." />}</div></section>
      <section id="admin-categories" className="admin-category-panel"><div><p className="eyebrow">Organize the library</p><h2>Categories</h2></div><form className="category-create" onSubmit={async event => { event.preventDefault(); if (!newCategory.trim()) return; setCategoryError(''); try { await onSaveCategory(newCategory.trim(), editingCategory); setNewCategory(''); setEditingCategory(null) } catch (saveError) { setCategoryError(saveError.message) } }}><label className="sr-only" htmlFor="new-category">{editingCategory ? 'Rename category' : 'New category name'}</label><input id="new-category" value={newCategory} onChange={event => setNewCategory(event.target.value)} placeholder={editingCategory ? `Rename ${editingCategory.name}` : 'Add a category'} /><button className="button button-quiet" type="submit">{editingCategory ? 'Save name' : 'Add category'}</button>{editingCategory && <button className="button button-quiet" type="button" onClick={() => { setEditingCategory(null); setNewCategory('') }}>Cancel</button>}</form>{categoryError && <p className="form-error category-form-error" role="alert">{categoryError}</p>}<div className="admin-category-list">{categories.map(item => <div className="admin-category-chip" key={item._id || item.slug}><CategoryIcon name={item.icon} size={15} /><span>{item.name}</span><small>{item.quizCount ?? quizzes.filter(quiz => quiz.category?.slug === item.slug).length}</small><button aria-label={`Rename ${item.name}`} title="Rename category" onClick={() => { setEditingCategory(item); setNewCategory(item.name); setCategoryError('') }}><Pencil size={12} /></button><button aria-label={`Delete ${item.name}`} title="Delete category" onClick={() => onDeleteCategory(item)}><Trash2 size={12} /></button></div>)}</div></section>
      </section>
      {form && <div className="modal-backdrop admin-modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setForm(null)}><section className="modal-panel admin-form-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-form-title"><div className="admin-form-head"><div><p className="eyebrow">Library editor</p><h2 id="quiz-form-title">{editing ? 'Edit quiz' : 'Create a quiz'}</h2></div><button className="icon-button" aria-label="Close form" onClick={() => setForm(null)}><XCircle size={20} /></button></div><form onSubmit={save}><div className="admin-form-grid"><label className="field-label">Quiz title<input required maxLength={100} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="A clear, useful title" /></label><label className="field-label">Category<select value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><label className="field-label">Difficulty<select value={form.difficulty} onChange={event => setForm({ ...form, difficulty: event.target.value })}><option>Easy</option><option>Medium</option><option>Hard</option></select></label><label className="field-label">Time limit (minutes)<input type="number" min="1" max="180" value={form.timeLimit} onChange={event => setForm({ ...form, timeLimit: event.target.value })} /></label><label className="field-label admin-description">Description<textarea rows="2" maxLength={500} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="What will learners practice?" /></label><label className="featured-toggle"><input type="checkbox" checked={form.featured} onChange={event => setForm({ ...form, featured: event.target.checked })} /> Feature this quiz on the home page</label></div>
        <div className="admin-question-editor"><div className="admin-question-heading"><div><p className="eyebrow">Quiz content</p><h3>Questions <span>{form.questions.length}</span></h3></div><button className="button button-quiet" type="button" onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion()] })}>+ Add question</button></div>{form.questions.map((question, index) => <article className="admin-question-card" key={question._id || index}><div className="admin-question-card-head"><strong>Question {index + 1}</strong>{form.questions.length > 1 && <button type="button" className="remove-question" onClick={() => setForm({ ...form, questions: form.questions.filter((_, questionIndex) => questionIndex !== index) })}>Remove</button>}</div><label className="field-label">Question text<textarea required rows="2" value={question.text} onChange={event => updateQuestion(index, { text: event.target.value })} /></label><div className="admin-options-grid">{question.options.map((option, optionIndex) => <label className="field-label" key={optionIndex}><span>Option {String.fromCharCode(65 + optionIndex)}{question.correctAnswer === optionIndex ? ' · correct' : ''}</span><input required value={option} onChange={event => updateQuestion(index, { options: question.options.map((item, idx) => idx === optionIndex ? event.target.value : item) })} /></label>)}</div><label className="field-label correct-select">Correct answer<select value={question.correctAnswer} onChange={event => updateQuestion(index, { correctAnswer: Number(event.target.value) })}>{question.options.map((option, optionIndex) => <option value={optionIndex} key={optionIndex}>{String.fromCharCode(65 + optionIndex)} · {option || 'Option text'}</option>)}</select></label><label className="field-label">Explanation <span className="optional-label">(optional)</span><input value={question.explanation || ''} onChange={event => updateQuestion(index, { explanation: event.target.value })} placeholder="Explain why this answer is correct" /></label></article>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button button-quiet" type="button" onClick={() => setForm(null)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create quiz'} <ArrowRight size={16} /></button></div></form></section></div>}
    </main>
  )
}

function Layers3Icon() {
  return <BookOpenCheck size={16} />
}

function CircleQuestionIcon(props) {
  return <Activity {...props} />
}