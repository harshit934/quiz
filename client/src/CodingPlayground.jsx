import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Play, RotateCcw, Save } from 'lucide-react'
import { generateCodingChallenge } from '../../shared/generateCodingChallenge.js'
import { runSubjectChallenge } from './utils/subjectRunner.js'
import { readPlaygroundDraft, readPlaygroundLanguage, savePlaygroundDraft } from './utils/playgroundDraft.js'
import './coding.css'

const languages = [['javascript', 'JavaScript'], ['python', 'Python'], ['html', 'HTML'], ['css', 'CSS'], ['react', 'React JSX'], ['sql', 'SQL'], ['mongodb', 'MongoDB query (JSON)'], ['java', 'Java'], ['node-js', 'Node.js'], ['cloud-computing', 'Bash']]
const defaults = {
  javascript: ['function solve(input) {\n  return input.map(n => n * 2);\n}', '[1, 2, 3]'],
  python: ['def solve(input):\n    return [n * 2 for n in input]', '[1, 2, 3]'],
  html: ['<main>\n  <h1>My practice page</h1>\n  <p>Build something here.</p>\n</main>', ''],
  css: ['.card {\n  padding: 24px;\n  border-radius: 16px;\n  background: #f3efe5;\n}\nh1 { color: #263a36; }', ''],
  react: ['function App() {\n  return <main><h1>My React playground</h1></main>;\n}', ''],
  sql: ['SELECT region, SUM(amount) AS total\nFROM sales GROUP BY region ORDER BY region;', '{"sales":[{"region":"East","amount":10},{"region":"West","amount":20},{"region":"East","amount":5}]}'],
  mongodb: ['[\n  { "$match": { "active": true } }\n]', '[{"name":"Ada","active":true},{"name":"Bob","active":false}]'],
  'node-js': ['function solve(input) {\n  return input;\n}', '[1, 2, 3]'],
  java: ['public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java!");\n    }\n}', ''],
  'cloud-computing': ['#!/usr/bin/env bash\nread -r name\nprintf "Hello, %s!\\n" "$name"', 'learner\n'],
}

export default function CodingPlayground({ user, onBack }) {
  const account = user?._id || user?.id
  const [language, setLanguage] = useState(() => {
    try { return readPlaygroundLanguage(window.localStorage, account, languages.map(([id]) => id)) }
    catch { return 'javascript' }
  })
  return <PlaygroundEditor key={`${account}-${language}`} account={account} language={language} onLanguage={setLanguage} onBack={onBack} />
}

function PlaygroundEditor({ account, language, onLanguage, onBack }) {
  const challenge = generateCodingChallenge(language, 'Easy', 1)
  const key = `quizly-playground-${account}-${challenge.runtime}`
  const draft = readPlaygroundDraft(window.localStorage, key)
  const [code, setCode] = useState(draft?.code ?? defaults[language][0])
  const [input, setInput] = useState(draft?.input ?? defaults[language][1])
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState(draft ? 'Saved draft restored from this browser.' : '')
  const [phase, setPhase] = useState('')
  const [output, setOutput] = useState(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const web = ['html', 'css', 'jsx'].includes(challenge.runtime)
  const stdin = ['java', 'bash'].includes(challenge.runtime)
  function edit(setter, value) { setter(value); setMessage('Unsaved changes'); setError(''); setOutput(null); setPreview('') }
  function save() {
    try {
      if (!savePlaygroundDraft(window.localStorage, key, { code, input })) throw new Error('Save failed')
      window.localStorage.setItem(`quizly-playground-${account}-language`, language)
      setMessage('Code and input saved in this browser. This language will reopen next time.')
    } catch { setMessage('Unable to save. Copy your code to keep it.') }
  }
  async function run() {
    if (running) return
    setRunning(true); setError(''); setOutput(null); setPreview('')
    try {
      let parsed = null
      if (!web && !stdin) { try { parsed = JSON.parse(input) } catch { throw new Error('Input must be valid JSON.') } }
      const testCases = web ? [] : [{ name: 'Output', input: parsed, stdin: stdin ? input : undefined, expected: null }]
      const result = await runSubjectChallenge({ ...challenge, testCases }, code, value => { if (active.current) setPhase(value) })
      if (active.current) { setOutput(result.results); setPreview(result.preview || '') }
    } catch (failure) { if (active.current) setError(failure.message) }
    finally { if (active.current) setRunning(false) }
  }
  const instructions = web ? challenge.runtime === 'css' ? 'Style the sample .card containing a heading, email input, and button. Run code to preview your CSS.' : challenge.runtime === 'jsx' ? 'Define an App component in JSX. React is provided; the preview renders its initial markup.' : 'Write HTML and run code to preview it. Scripts are disabled in previews.' : stdin ? 'Write a complete program and print your answer to standard output.' : challenge.runtime === 'sql' ? 'Write a SQLite query. Edit the sales rows in the JSON input below.' : challenge.runtime === 'mongodb' ? 'Enter a MongoDB JSON aggregation pipeline. Edit the sample documents below.' : 'Define solve(input) and return a value. Edit the JSON input below to try different examples.'
  return <main className="coding-hub coding-playground">
    <button className="coding-back" onClick={onBack} disabled={running}><ArrowLeft size={18} />Coding Practice</button>
    <div className="coding-hub-heading"><div><p className="eyebrow">Make room for practice</p><h1>Coding Playground</h1><p>Write freely, run your code, and save your draft.</p></div><button className="button button-quiet" onClick={save}><Save size={16} />Save code</button></div>
    <div className="coding-filters"><label htmlFor="playground-language">Language<select id="playground-language" value={language} disabled={running} onChange={event => onLanguage(event.target.value)}>{languages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><p role="status">{message || 'Drafts are saved separately for each language.'}</p></div>
    <p className="muted">{instructions}</p>
    {['java', 'nodejs', 'bash'].includes(challenge.runtime) && <p className="muted">This language requires the configured isolated compiler service.</p>}
    <section className="coding-editor-panel" aria-label="Playground editor">
      <div className="coding-language-bar"><span className="coding-js-logo">{challenge.badge}</span><strong>{challenge.language}</strong><button className="icon-button" aria-label="Reset playground code" disabled={running} onClick={() => { edit(setCode, defaults[language][0]); setInput(defaults[language][1]) }}><RotateCcw size={18} /></button></div>
      <label className="sr-only" htmlFor="playground-code">{challenge.language} playground editor</label><textarea id="playground-code" className="coding-code-input playground-code" value={code} disabled={running} spellCheck={false} onChange={event => edit(setCode, event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run() } }} />
      <div className="coding-run-bar"><span aria-live="polite">{running ? phase : '3-second execution limit · Ctrl+Enter to run'}</span><button className="button button-primary" disabled={running} onClick={run}><Play size={16} />{running ? 'Running…' : 'Run code'}</button></div>
    </section>
    {!web && <label className="playground-input-label" htmlFor="playground-input">{stdin ? 'Standard input' : 'JSON input'}<textarea id="playground-input" value={input} disabled={running} spellCheck={false} onChange={event => edit(setInput, event.target.value)} /></label>}
    <section className="playground-output" aria-label="Playground output"><h2>{web ? 'Preview' : 'Output'}</h2><div aria-live="polite">{error && <p role="alert" className="form-error">{error}</p>}{output?.map(item => <pre className="coding-reference" key={item.name}>{item.error || (typeof item.actual === 'string' ? item.actual : JSON.stringify(item.actual, null, 2))}</pre>)}{preview && <iframe title="Playground preview" sandbox="allow-same-origin" srcDoc={preview} />}{!output && !error && <p className="muted">Run your code to see {web ? 'a preview' : 'the output'}.</p>}</div></section>
    <p className="coding-local-note">Saved code stays in this browser for your account. Save changes before switching languages or leaving the page.</p>
  </main>
}
