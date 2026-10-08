import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Code2, FileText, HelpCircle, Maximize2, Minimize2, Play, RotateCcw, Save } from 'lucide-react'
import { codingChallenges } from '../../shared/codingChallenges.js'
import { runSubjectChallenge } from './utils/subjectRunner.js'
import { subjectLanguages } from '../../shared/nativeCodingChallenges.js'
import { generateCodingChallenge, nextCodingAttempt } from '../../shared/generateCodingChallenge.js'
import { codingScore, readCodingProgress, writeCodingProgress, readCodingDraft } from './utils/codingProgress.js'
import './coding.css'

const subjects = codingChallenges.filter(item => item.difficulty === 'Easy')
const display = value => JSON.stringify(value, null, 2)
const limits = { Easy: 40, Medium: 60, Hard: 100 }

export default function CodingPage({ user, onPlayground }) {
  const [subject, setSubject] = useState(subjects[0].subjectId)
  const [difficulty, setDifficulty] = useState('All')
  const [challenge, setChallenge] = useState(null)
  const storageKey = `quizly-coding-progress-${user?.id || user?._id || 'guest'}`
  const [progress, setProgress] = useState(() => readCodingProgress(window.localStorage, storageKey))
  function updateProgress(next) {
    setProgress(current => {
      const updated = { ...current, [`${next.subjectId}-${next.difficulty}`]: next }
      writeCodingProgress(window.localStorage, storageKey, updated)
      return updated
    })
  }
  function openQuestion(level) {
    const next = generateCodingChallenge(subject, level, nextCodingAttempt(window.localStorage))
    setChallenge(next)
    updateProgress({ subjectId: subject, difficulty: level, status: 'In progress', passed: 0, total: next.testCases.length, score: 0 })
  }
  const rows = codingChallenges.filter(item => item.subjectId === subject && (difficulty === 'All' || item.difficulty === difficulty))
  const draft = readCodingDraft(window.localStorage, storageKey)
  const savedDraft = draft?.challenge.runtime === subjectLanguages[draft?.challenge.subjectId]?.runtime ? draft : null
  if (challenge) return <CodingExercise key={challenge.id} challenge={challenge} onBack={() => setChallenge(null)} onNewAttempt={() => openQuestion(challenge.difficulty)} onProgress={updateProgress} storageKey={storageKey} />
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
    <p className="coding-local-note">Practice scores stay in this browser. Opening a question starts a new attempt.</p>
  </main>
}

function CodingExercise({ challenge, onNewAttempt, onBack, onProgress, storageKey }) {
  const [code, setCode] = useState(challenge.draft ?? challenge.starter)
  const [results, setResults] = useState(null)
  const [preview, setPreview] = useState('')
  const [phase, setPhase] = useState('')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [tab, setTab] = useState('description')
  const [showSolution, setShowSolution] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [savedNotice, setSavedNotice] = useState('')
  const active = useRef(true), gutter = useRef(null), editor = useRef(null)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const passed = results?.filter(item => item.passed).length || 0
  function report(next) { onProgress({ subjectId: challenge.subjectId, difficulty: challenge.difficulty, total: challenge.testCases.length, ...next }) }
  function changeCode(value) {
    setCode(value); setPreview(''); setResults(null); setError(''); setSavedNotice('')
    report({ status: 'In progress', passed: 0, score: 0, tested: false })
  }
  function saveCode() {
    try { window.localStorage.setItem(`${storageKey}-saved-code`, JSON.stringify({ challenge, code })); setSavedNotice('Code saved in this browser.') }
    catch { setSavedNotice('Storage unavailable. Copy your code to keep it.') }
  }
  async function run() {
    if (running) return
    setRunning(true); setError(''); setResults(null)
    try {
      const output = await runSubjectChallenge(challenge, code, value => { if (active.current) setPhase(value) })
      const next = output.results
      if (active.current) {
        setResults(next); setPreview(output.preview || '')
        const count = next.filter(item => item.passed).length
        report({ status: count === next.length ? 'Completed' : 'In progress', passed: count, tested: true, score: codingScore(count, next.length, challenge.difficulty) })
      }
    } catch (failure) {
      if (active.current) { setError(failure.message); report({ status: 'In progress', passed: 0, score: 0, tested: true }) }
    } finally { if (active.current) setRunning(false) }
  }
  return <main className={`coding-workspace ${maximized ? 'coding-workspace-maximized' : ''}`}>
    <div className="coding-workspace-heading"><button className="coding-back" onClick={onBack} disabled={running}><ArrowLeft size={20} /> Coding Practice</button><button className="button button-quiet" onClick={onNewAttempt} disabled={running}>New attempt <ArrowRight size={15} /></button></div>
    <div className="coding-workspace-grid">
      <section className="coding-description-panel">
        <div className="coding-description-tabs" role="tablist" aria-label="Challenge information"><button id="description-tab" role="tab" aria-selected={tab === 'description'} aria-controls="coding-info" onClick={() => setTab('description')}><FileText size={18} /> Description</button><button id="help-tab" role="tab" aria-selected={tab === 'help'} aria-controls="coding-info" onClick={() => setTab('help')}><HelpCircle size={18} /> Get Help</button></div>
        <div className="coding-description-content" id="coding-info" role="tabpanel" aria-labelledby={tab === 'description' ? 'description-tab' : 'help-tab'}>
          <div className="coding-title-row"><h1>{challenge.title}</h1><span className={`coding-status coding-status-${results && passed === results.length ? 'complete' : 'progress'}`}><i />{results && passed === results.length ? 'Completed' : 'In progress'}</span></div>
          <span className={`coding-level coding-level-${challenge.difficulty.toLowerCase()}`}>{challenge.difficulty}</span>
          {tab === 'description' ? <><p className="coding-task-description">{challenge.description}</p><h2>Your task</h2><p>{challenge.instructions}</p><h2>Sample test cases</h2><TestCases challenge={challenge} results={results} /></> : <><h2>How to solve this challenge</h2><ol className="coding-help-list"><li>Read the requirements for this attempt.</li><li>Inspect each input and expected output.</li><li>{challenge.instructions}</li><li>Run test cases and revise any failing output.</li></ol><p>Use Tab to indent and Ctrl+Enter to run. Code execution stops after three seconds, after the language runtime loads.</p><button className="button button-quiet" onClick={() => setShowSolution(value => !value)}>{showSolution ? 'Hide' : 'Show'} reference solution</button>{showSolution && <pre className="coding-reference">{challenge.solution}</pre>}</>}
        </div>
        <div className="coding-description-footer"><Code2 size={17} />{challenge.subject}<span>Practice · {limits[challenge.difficulty]} points</span></div>
      </section>
      <section className="coding-editor-panel" aria-label="Coding workspace">
        <div className="coding-editor-toolbar"><span>Code editor</span><div><button className="icon-button" aria-label="Save code" title="Save code" onClick={saveCode}><Save size={18} /></button><button className="icon-button" aria-label="Reset code" title="Reset code" disabled={running} onClick={() => changeCode(challenge.starter)}><RotateCcw size={18} /></button><button className="icon-button" aria-label={maximized ? 'Restore editor' : 'Maximize editor'} title={maximized ? 'Restore editor' : 'Maximize editor'} onClick={() => setMaximized(value => !value)}>{maximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button></div></div>
        <div className="coding-language-bar"><span className="coding-js-logo">{challenge.badge}</span><strong>{challenge.language.toUpperCase()}</strong><small>{challenge.runtime === 'java' ? 'Main.java' : challenge.runtime === 'jsx' ? 'App.jsx' : challenge.runtime === 'python' ? 'main.py' : challenge.runtime === 'html' ? 'index.html' : challenge.runtime === 'css' ? 'styles.css' : challenge.language}</small></div>
        <div className="coding-editor-surface"><div className="coding-line-numbers" ref={gutter} aria-hidden="true">{code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}</div><label className="sr-only" htmlFor="coding-editor">{challenge.language} editor</label><textarea ref={editor} id="coding-editor" className="coding-code-input" spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" value={code} disabled={running} onChange={event => changeCode(event.target.value)} onScroll={event => { if (gutter.current) gutter.current.scrollTop = event.target.scrollTop }} onKeyDown={event => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run() }
          if (event.key === 'Tab') {
            event.preventDefault()
            const start = event.currentTarget.selectionStart, end = event.currentTarget.selectionEnd
            changeCode(code.slice(0, start) + '  ' + code.slice(end))
            requestAnimationFrame(() => editor.current?.setSelectionRange(start + 2, start + 2))
          }
        }} /></div>
        <div className="coding-run-bar"><span aria-live="polite">{running ? phase : savedNotice || `${challenge.language} · 3-second execution limit`}</span><button className="button button-primary" onClick={run} disabled={running}><Play size={16} />{running ? 'Running…' : 'Run test cases'}</button></div>
        {preview && <section className="coding-preview-panel"><h2>Preview</h2><iframe title="Your code preview" sandbox="allow-same-origin" srcDoc={preview} /></section>}
        <section className="coding-results-panel" aria-label="Test results"><div className="coding-results-heading"><h2>Test results</h2>{results && <span className={passed === results.length ? 'coding-pass' : 'coding-fail'}>{passed}/{results.length} passed · {codingScore(passed, results.length, challenge.difficulty)}/{limits[challenge.difficulty]} points</span>}</div><div aria-live="polite">{error ? <p className="form-error" role="alert">{error}</p> : results ? <><p className="coding-result-message">{passed === results.length ? '✓ All tests passed!' : 'Some cases failed. Check the actual output below.'}</p><div className="coding-result-chips">{results.map((item, i) => <span key={item.name} className={item.passed ? 'coding-result-pass' : 'coding-result-fail'}>Case {i + 1} {item.passed ? '✓' : '✗'}</span>)}</div>{results.filter(item => !item.passed).map(item => <pre className="coding-reference" key={item.name}>{item.name}: {item.error || display(item.actual)}</pre>)}</> : <p className="coding-results-empty">Run your code to see test results here.</p>}</div></section>
      </section>
    </div>
  </main>
}

function TestCases({ challenge, results }) {
  return <div className="coding-samples">{challenge.testCases.map((test, index) => <article className="coding-sample" key={test.name}><strong>{test.name} {results && <span className={results[index].passed ? 'coding-pass' : 'coding-fail'}>{results[index].passed ? '✓ Passed' : '✗ Failed'}</span>}</strong><p>{test.assertion ? 'Element and expected property' : 'Input'}</p><pre>{display(test.assertion || test.input)}</pre>{!test.assertion && <><p>Expected output</p><pre>{display(test.expected)}</pre></>}{results && !results[index].passed && <><p>Actual result</p><pre>{results[index].error || display(results[index].actual)}</pre></>}</article>)}</div>
}
