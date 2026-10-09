import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Code2, FileText, HelpCircle, Maximize2, Minimize2, Play, RotateCcw, Save } from 'lucide-react'
import { codingChallenges } from '../../shared/codingChallenges.js'
import { runSubjectChallenge } from './utils/subjectRunner.js'
import { subjectLanguages } from '../../shared/nativeCodingChallenges.js'
import { generateCodingChallenge, nextCodingAttempt } from '../../shared/generateCodingChallenge.js'
import { codingScore, readCodingProgress, writeCodingProgress, readCodingDraft } from './utils/codingProgress.js'
import './coding.css'
import { codingMinutes, timedChallenge, remainingSeconds, clockLabel } from './utils/codingTimer.js'
import { readPracticeMistakes, updatePracticeMistakes, writePracticeMistakes } from './utils/practiceMistakes.js'
import { useLearning } from './LearningContext.jsx'
import LearningPanel, { BookmarkButton } from './LearningPanel.jsx'
import { dayKey } from '../../shared/learningState.js'
import { codingHints } from './utils/codingHints.js'

const subjects = codingChallenges.filter(item => item.difficulty === 'Easy')
const display = value => JSON.stringify(value, null, 2)
const limits = { Easy: 40, Medium: 60, Hard: 100 }

export default function CodingPage({ user, onPlayground, bookmarkId }) {
  const learning = useLearning()
  const [subject, setSubject] = useState(subjects[0].subjectId)
  const [difficulty, setDifficulty] = useState('All')
  const [challenge, setChallenge] = useState(null)
  const storageKey = `quizly-coding-progress-${user?.id || user?._id || 'guest'}`
  const [localProgress, setProgress] = useState(() => readCodingProgress(window.localStorage, storageKey))
  const [localMistakes, setMistakes] = useState(() => readPracticeMistakes(window.localStorage, storageKey))
  const progress = learning?.state.progress || localProgress
  const mistakes = learning?.state.mistakes || localMistakes
  const [review, setReview] = useState(null)
  const [mistakeNotice, setMistakeNotice] = useState('')
  const openedBookmark = useRef(null)
  useEffect(() => {
    const item = learning?.state.bookmarks[`coding-${bookmarkId}`]
    if (!bookmarkId || !item?.challenge || openedBookmark.current === bookmarkId) return
    openedBookmark.current = bookmarkId
    setSubject(item.challenge.subjectId)
    setChallenge(timedChallenge({ ...item.challenge, deadline: undefined, draft: undefined }))
  }, [bookmarkId, learning?.state.bookmarks])
  function recordMistake(attempt, code, results) {
    const updated = updatePracticeMistakes(mistakes, attempt, code, results)
    setMistakes(updated)
    setMistakeNotice(writePracticeMistakes(window.localStorage, storageKey, updated) ? '' : 'Mistake history could not be saved. Keep this page open or copy your code.')
    const count = results.filter(row => row.passed).length
    learning?.dispatch('coding', { challenge: { ...attempt, draft: undefined, deadline: undefined }, code, results, day: dayKey(), progress: { subjectId: attempt.subjectId, difficulty: attempt.difficulty, total: attempt.testCases.length, passed: count, score: codingScore(count, attempt.testCases.length, attempt.difficulty), tested: true, status: count === attempt.testCases.length ? 'Completed' : 'In progress' } })
  }
  function updateProgress(next) {
    setProgress(current => {
      const updated = { ...current, [`${next.subjectId}-${next.difficulty}`]: next }
      writeCodingProgress(window.localStorage, storageKey, updated)
      return updated
    })
  }
  function openQuestion(level) {
    const next = timedChallenge(generateCodingChallenge(subject, level, nextCodingAttempt(window.localStorage)))
    setChallenge(next)
    updateProgress({ subjectId: subject, difficulty: level, status: 'In progress', passed: 0, total: next.testCases.length, score: 0 })
  }
  const rows = codingChallenges.filter(item => item.subjectId === subject && (difficulty === 'All' || item.difficulty === difficulty))
  const draft = readCodingDraft(window.localStorage, storageKey)
  const savedDraft = draft?.challenge.runtime === subjectLanguages[draft?.challenge.subjectId]?.runtime ? draft : null
  if (challenge) return <CodingExercise key={challenge.id} challenge={challenge} onBack={() => setChallenge(null)} onNewAttempt={() => openQuestion(challenge.difficulty)} onProgress={updateProgress} onMistake={recordMistake} mistakeNotice={mistakeNotice} storageKey={storageKey} />
  return <main className="coding-hub">
    <div className="coding-breadcrumb"><Code2 size={19} /><span>Technology › <strong>Coding Practice</strong></span></div>
    <div className="coding-hub-heading"><div><p className="eyebrow">Learn by building</p><h1>Coding Practice</h1><p>Choose a challenge. Write your solution. Pass every test.</p></div><div className="coding-hub-actions"><span className="coding-library-count">18 subjects · 3 levels</span><button className="button button-primary" onClick={onPlayground}><Code2 size={16} />Open playground</button></div></div>
    {savedDraft && <button className="button button-quiet" onClick={() => { setSubject(savedDraft.challenge.subjectId); setChallenge({ ...savedDraft.challenge, draft: savedDraft.code }) }}><Save size={15} /> Resume saved code · {savedDraft.challenge.subject}</button>}
    <div className="coding-filters">
      <label htmlFor="coding-subject">Subject<select id="coding-subject" value={subject} onChange={event => setSubject(event.target.value)}>{subjects.map(item => <option key={item.subjectId} value={item.subjectId}>{item.subject}</option>)}</select></label>
      <label htmlFor="coding-level">Difficulty<select id="coding-level" value={difficulty} onChange={event => setDifficulty(event.target.value)}>{['All', 'Easy', 'Medium', 'Hard'].map(level => <option key={level} value={level}>{level === 'All' ? 'All levels' : level}</option>)}</select></label>
      <p>Each attempt generates a fresh variation.</p>
    </div>
    <div className="coding-table-scroll"><table className="coding-question-table"><thead><tr><th>Question</th><th>Difficulty</th><th>Test cases passed</th><th>Score</th><th>Status</th><th><span className="sr-only">Open question</span></th></tr></thead><tbody>{rows.map(item => {
      const saved = progress[`${item.subjectId}-${item.difficulty}`]
      return <tr key={item.id}>
        <td><button className="coding-question-name" onClick={() => openQuestion(item.difficulty)}>{generateCodingChallenge(item.subjectId, item.difficulty, 1).title.replace(/ · .*$/, '')}</button><small>{item.subject} · {subjectLanguages[item.subjectId].language}</small></td>
        <td><span className={`coding-level coding-level-${item.difficulty.toLowerCase()}`}>{item.difficulty}</span></td>
        <td><span>{saved?.tested ? `${saved.passed} / ${saved.total}` : '— / —'}</span><progress aria-label={`${item.difficulty} test cases passed`} value={saved?.tested ? saved.passed : 0} max={saved?.total || item.testCases.length} /></td>
        <td><span>{saved?.tested ? saved.score : '—'} / {limits[item.difficulty]}</span><progress aria-label={`${item.difficulty} score`} value={saved?.score || 0} max={limits[item.difficulty]} /></td>
        <td><span className={`coding-status coding-status-${saved?.status === 'Completed' ? 'complete' : saved ? 'progress' : 'new'}`}><i />{saved?.status || 'Not attempted'}</span></td>
        <td><button className="coding-open" onClick={() => openQuestion(item.difficulty)} aria-label={`Start ${item.difficulty} ${item.subject} coding challenge`}><ArrowRight size={20} /></button></td>
      </tr>
    })}</tbody></table></div>
    <p className="coding-local-note">Easy: 15 minutes · Medium: 30 minutes · Hard: 45 minutes. The timer starts when you open a question. Scores and mistakes sync when your account is connected.</p>
    <LearningPanel user={user} onQuiz={id => { window.location.hash = `#quiz/${id}` }} onCoding={saved => { setSubject(saved.subjectId); setChallenge(timedChallenge({ ...saved, deadline: undefined, draft: undefined })) }} />
    <section className="practice-mistakes" aria-label="Practice mistakes">
      <h2>Practice mistakes ({mistakes.filter(item => !item.resolved).length} to retry)</h2>
      <p>Review failed coding attempts and retry the same question with a fresh timer. Your latest 50 mistakes sync to your account, with a browser copy kept while offline.</p>
      {mistakeNotice && <p role="alert">{mistakeNotice}</p>}
      {!mistakes.length && <p>No mistakes recorded yet. Failed test runs will appear here.</p>}
      {mistakes.map(item => <article className="practice-mistake" key={item.challenge.id}>
        <strong>{item.challenge.title}</strong><p>{item.challenge.subject} · {item.challenge.difficulty} · {item.resolved ? 'Resolved' : `${item.results.filter(result => !result.passed).length} failed cases`}</p>
        <button className="button button-quiet" onClick={() => setReview(review === item.challenge.id ? null : item.challenge.id)}>{review === item.challenge.id ? 'Hide details' : 'Review mistakes'}</button>{' '}
        <button className="button button-primary" onClick={() => { setSubject(item.challenge.subjectId); setChallenge(timedChallenge({ ...item.challenge, draft: item.code })) }}>Retry question</button>
        {review === item.challenge.id && <div><h3>Your saved code</h3><pre className="coding-reference">{item.code}</pre><h3>Failed test results</h3>{item.results.filter(result => !result.passed).map((result, index) => {
          const test = item.challenge.testCases.find(test => test.name === result.name)
          return <div key={index}><strong>{result.name}</strong>{test && <><p>Input / assertion</p><pre className="coding-reference">{display(test.assertion ?? test.input ?? test.stdin)}</pre><p>Expected</p><pre className="coding-reference">{display(test.assertion ?? test.expected)}</pre></>}<p>Actual / error</p><pre className="coding-reference">{result.error || display(result.actual)}</pre></div>
        })}</div>}
      </article>)}
    </section>
  </main>
}

function CodingExercise({ challenge, onNewAttempt, onBack, onProgress, onMistake, mistakeNotice, storageKey }) {
  const [deadline] = useState(() => timedChallenge(challenge).deadline)
  const [seconds, setSeconds] = useState(() => remainingSeconds(deadline))
  const expired = seconds === 0
  const expiryHandled = useRef(false)
  const [code, setCode] = useState(challenge.draft ?? challenge.starter)
  const [results, setResults] = useState(null)
  const [preview, setPreview] = useState('')
  const [phase, setPhase] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [tab, setTab] = useState('description')
  const [showSolution, setShowSolution] = useState(false)
  const [hintCount, setHintCount] = useState(0)
  const [maximized, setMaximized] = useState(false)
  const [savedNotice, setSavedNotice] = useState('')
  const active = useRef(true), gutter = useRef(null), editor = useRef(null)
  useEffect(() => {
    const tick = () => setSeconds(remainingSeconds(deadline))
    const interval = setInterval(tick, 1000)
    window.addEventListener('focus', tick)
    return () => { clearInterval(interval); window.removeEventListener('focus', tick) }
  }, [deadline])
  useEffect(() => {
    if (!expired || expiryHandled.current) return
    expiryHandled.current = true
    saveCode()
    report({ status: 'Time expired', passed: results?.filter(item => item.passed).length || 0, tested: !!results, score: codingScore(results?.filter(item => item.passed).length || 0, challenge.testCases.length, challenge.difficulty) })
  }, [expired])
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const passed = results?.filter(item => item.passed).length || 0
  function report(next) { onProgress({ subjectId: challenge.subjectId, difficulty: challenge.difficulty, total: challenge.testCases.length, ...next }) }
  function changeCode(value) {
    setCode(value); setPreview(''); setResults(null); setError(''); setSavedNotice('')
    report({ status: 'In progress', passed: 0, score: 0, tested: false })
  }
  function saveCode() {
    try { window.localStorage.setItem(`${storageKey}-saved-code`, JSON.stringify({ challenge: { ...challenge, deadline }, code })); setSavedNotice('Code saved in this browser.') }
    catch { setSavedNotice('Storage unavailable. Copy your code to keep it.') }
  }
  async function run() {
    if (running || remainingSeconds(deadline) === 0) return
    setRunning(true); setError(''); setResults(null)
    try {
      const output = await runSubjectChallenge(challenge, code, value => { if (active.current) setPhase(value) })
      const next = output.results
      if (active.current && remainingSeconds(deadline) > 0) {
        setResults(next); setPreview(output.preview || '')
        onMistake(challenge, code, next)
        const count = next.filter(item => item.passed).length
        report({ status: count === next.length ? 'Completed' : 'In progress', passed: count, tested: true, score: codingScore(count, next.length, challenge.difficulty) })
      }
    } catch (failure) {
      if (active.current && remainingSeconds(deadline) > 0) { setError(failure.message); onMistake(challenge, code, [{ name: 'Execution error', passed: false, error: failure.message }]); report({ status: 'In progress', passed: 0, score: 0, tested: true }) }
    } finally { if (active.current) setRunning(false) }
  }
  return <main className={`coding-workspace ${maximized ? 'coding-workspace-maximized' : ''}`}>
    {mistakeNotice && <p role="alert">{mistakeNotice}</p>}
    <div className="coding-workspace-heading"><button className="coding-back" onClick={onBack} disabled={running}><ArrowLeft size={20} /> Coding Practice</button><BookmarkButton bookmarkKey={`coding-${challenge.id}`} item={{ kind: 'coding', title: challenge.title, challenge: { ...challenge, deadline: undefined, draft: undefined } }} /><div className="coding-exam-clock" role="timer" aria-label="Time remaining"><strong>{clockLabel(seconds)}</strong><span>{expired ? 'Time expired' : `${codingMinutes[challenge.difficulty]} minute attempt`}</span></div><button className="button button-quiet" onClick={onNewAttempt} disabled={running}>New attempt <ArrowRight size={15} /></button></div>
    <>{expired && <p className="coding-time-expired" role="alert">Time is up. Your code has been saved. Start a new attempt to try again.</p>}</><div className="coding-workspace-grid">
      <section className="coding-description-panel">
        <div className="coding-description-tabs" role="tablist" aria-label="Challenge information"><button id="description-tab" role="tab" aria-selected={tab === 'description'} aria-controls="coding-info" onClick={() => setTab('description')}><FileText size={18} /> Description</button><button id="help-tab" role="tab" aria-selected={tab === 'help'} aria-controls="coding-info" onClick={() => setTab('help')}><HelpCircle size={18} /> Get Help</button></div>
        <div className="coding-description-content" id="coding-info" role="tabpanel" aria-labelledby={tab === 'description' ? 'description-tab' : 'help-tab'}>
          <div className="coding-title-row"><h1>{challenge.title}</h1><span className={`coding-status coding-status-${results && passed === results.length ? 'complete' : 'progress'}`}><i />{expired ? 'Time expired' : results && passed === results.length ? 'Completed' : 'In progress'}</span></div>
          <span className={`coding-level coding-level-${challenge.difficulty.toLowerCase()}`}>{challenge.difficulty}</span>
          {tab === 'description' ? <><p className="coding-task-description">{challenge.description}</p><h2>Your task</h2><p>{challenge.instructions}</p><h2>Sample test cases</h2><TestCases challenge={challenge} results={results} /></> : <><h2>Hints</h2><p>Try one clue at a time before revealing the solution.</p><ol className="coding-help-list">{codingHints(challenge).slice(0, hintCount).map((hint, index) => <li key={index}>{hint}</li>)}</ol><button className="button button-quiet" disabled={hintCount === 3} onClick={() => setHintCount(count => count + 1)}>{hintCount === 3 ? 'All hints revealed' : `Show hint ${hintCount + 1}`}</button><p>Use Tab to indent and Ctrl+Enter to run. Code execution stops after three seconds, after the language runtime loads.</p><button className="button button-quiet" disabled={hintCount < 3} onClick={() => setShowSolution(value => !value)}>{showSolution ? 'Hide' : 'Show'} reference solution</button>{hintCount < 3 && <p>Reveal the three hints to unlock the reference solution.</p>}{showSolution && <pre className="coding-reference">{challenge.solution}</pre>}</>}
        </div>
        <div className="coding-description-footer"><Code2 size={17} />{challenge.subject}<span>Practice · {limits[challenge.difficulty]} points</span></div>
      </section>
      <section className="coding-editor-panel" aria-label="Coding workspace">
        <div className="coding-editor-toolbar"><span>Code editor</span><div><button className="icon-button" aria-label="Save code" title="Save code" onClick={saveCode}><Save size={18} /></button><button className="icon-button" aria-label="Reset code" title="Reset code" disabled={running || expired} onClick={() => changeCode(challenge.starter)}><RotateCcw size={18} /></button><button className="icon-button" aria-label={maximized ? 'Restore editor' : 'Maximize editor'} title={maximized ? 'Restore editor' : 'Maximize editor'} onClick={() => setMaximized(value => !value)}>{maximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button></div></div>
        <div className="coding-language-bar"><span className="coding-js-logo">{challenge.badge}</span><strong>{challenge.language.toUpperCase()}</strong><small>{challenge.runtime === 'java' ? 'Main.java' : challenge.runtime === 'jsx' ? 'App.jsx' : challenge.runtime === 'python' ? 'main.py' : challenge.runtime === 'html' ? 'index.html' : challenge.runtime === 'css' ? 'styles.css' : challenge.language}</small></div>
        <div className="coding-editor-surface"><div className="coding-line-numbers" ref={gutter} aria-hidden="true">{code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div><label className="sr-only" htmlFor="coding-editor">{challenge.language} editor</label><textarea ref={editor} id="coding-editor" className="coding-code-input" spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" value={code} disabled={running || expired} onChange={event => changeCode(event.target.value)} onScroll={event => { if (gutter.current) gutter.current.scrollTop = event.target.scrollTop }} onKeyDown={event => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run() }
          if (event.key === 'Tab') {
            event.preventDefault()
            const start = event.currentTarget.selectionStart, end = event.currentTarget.selectionEnd
            changeCode(code.slice(0, start) + '  ' + code.slice(end))
            requestAnimationFrame(() => editor.current?.setSelectionRange(start + 2, start + 2))
          }
        }} /></div>
        <div className="coding-run-bar"><span aria-live="polite">{running ? phase : savedNotice || `${challenge.language} · 3-second execution limit`}</span><button className="button button-primary" onClick={run} disabled={running || expired}><Play size={16} />{running ? 'Running…' : 'Run test cases'}</button></div>
        {preview && <section className="coding-preview-panel"><h2>Preview</h2><iframe title="Your code preview" sandbox="allow-same-origin" srcDoc={preview} /></section>}
        <section className="coding-results-panel" aria-label="Test results"><div className="coding-results-heading"><h2>Test results</h2>{results && <span className={passed === results.length ? 'coding-pass' : 'coding-fail'}>{passed}/{results.length} passed · {codingScore(passed, results.length, challenge.difficulty)}/{limits[challenge.difficulty]} points</span>}</div><div aria-live="polite">{error ? <p className="form-error" role="alert">{error}</p> : results ? <><p className="coding-result-message">{passed === results.length ? '✓ All tests passed!' : 'Some cases failed. Check the actual output below.'}</p><div className="coding-result-chips">{results.map((item, i) => <span key={item.name} className={item.passed ? 'coding-result-pass' : 'coding-result-fail'}>Case {i + 1} {item.passed ? '✓' : '✗'}</span>)}</div>{results.filter(item => !item.passed).map(item => <pre className="coding-reference" key={item.name}>{item.name}: {item.error || display(item.actual)}</pre>)}</> : <p className="coding-results-empty">Run your code to see test results here.</p>}</div></section>
      </section>
    </div>
  </main>
}

function TestCases({ challenge, results }) {
  return <div className="coding-samples">{challenge.testCases.map((test, index) => <article className="coding-sample" key={test.name}><strong>{test.name} {results && <span className={results[index].passed ? 'coding-pass' : 'coding-fail'}>{results[index].passed ? '✓ Passed' : '✗ Failed'}</span>}</strong><p>{test.assertion ? 'Element and expected property' : 'Input'}</p><pre>{display(test.assertion || test.input)}</pre>{!test.assertion && <><p>Expected output</p><pre>{display(test.expected)}</pre></>}{results && !results[index].passed && <><p>Actual result</p><pre>{results[index].error || display(results[index].actual)}</pre></>}</article>)}</div>
}
