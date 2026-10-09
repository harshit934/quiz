import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Download, Play, RotateCcw, Save } from 'lucide-react'
import { generateCodingChallenge } from '../../shared/generateCodingChallenge.js'
import { runSubjectChallenge } from './utils/subjectRunner.js'
import { readPlaygroundDraft, readPlaygroundLanguage, savePlaygroundDraft, readNamedPrograms, saveNamedProgram, listSavedPrograms, renameSavedProgram, deleteSavedProgram } from './utils/playgroundDraft.js'
import { downloadProgram } from './utils/programDownload.js'
import { loadCloudPrograms, putCloudProgram, removeCloudProgram, mergeProgramLibrary } from './utils/cloudPrograms.js'
import { compilerLanguages } from '../../shared/playgroundLanguages.js'
import './coding.css'

const languages = [['javascript', 'JavaScript'], ['python', 'Python'], ['html', 'HTML'], ['css', 'CSS'], ['react', 'React JSX'], ['sql', 'SQL'], ['mongodb', 'MongoDB query (JSON)'], ...compilerLanguages.map(([id, label]) => [id === 'nodejs' ? 'node-js' : id === 'bash' ? 'cloud-computing' : id, label])]
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
for (const [id, , , starter] of compilerLanguages) defaults[id === 'nodejs' ? 'node-js' : id === 'bash' ? 'cloud-computing' : id] = [starter, '']

export default function CodingPlayground({ user, onBack }) {
  const account = user?._id || user?.id
  const [language, setLanguage] = useState(() => {
    try { return readPlaygroundLanguage(window.localStorage, account, languages.map(([id]) => id)) }
    catch { return 'javascript' }
  })
  const [opened, setOpened] = useState(() => readNamedPrograms(window.localStorage, account).find(item => item.language === language) || null)
  const [openVersion, setOpenVersion] = useState(0)
  return <PlaygroundEditor key={`${account}-${language}-${openVersion}`} account={account} language={language} opened={opened} focusEditor={openVersion > 0} onOpen={program => { setLanguage(program.language); setOpened(program); setOpenVersion(value => value + 1) }} onLanguage={value => { setOpened(readNamedPrograms(window.localStorage, account).find(item => item.language === value) || null); setLanguage(value); setOpenVersion(0) }} onBack={onBack} />
}

function PlaygroundEditor({ account, language, opened, focusEditor, onOpen, onLanguage, onBack }) {
  const compiled = compilerLanguages.find(([id]) => id === (language === 'node-js' ? 'nodejs' : language === 'cloud-computing' ? 'bash' : language))
  const challenge = compiled ? { runtime: compiled[0], language: compiled[1], badge: compiled[1].slice(0, 3) } : generateCodingChallenge(language, 'Easy', 1)
  const key = `quizly-playground-${account}-${challenge.runtime}`
  const draft = readPlaygroundDraft(window.localStorage, key)
  const [code, setCode] = useState(opened?.code ?? draft?.code ?? defaults[language][0])
  const [input, setInput] = useState(opened?.input ?? draft?.input ?? defaults[language][1])
  const [programName, setProgramName] = useState(opened?.name || '')
  const [programId, setProgramId] = useState(opened?.id || null)
  const [programs, setPrograms] = useState(() => listSavedPrograms(window.localStorage, account, languages))
  const [cloudPrograms, setCloudPrograms] = useState([])
  const [syncing, setSyncing] = useState(true)
  const [cloudError, setCloudError] = useState('')
  const [revision, setRevision] = useState(opened?.revision || 0)
  const [management, setManagement] = useState(null)
  const [managementError, setManagementError] = useState('')
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState(opened ? `Opened “${opened.name}” from this browser.` : draft ? 'Saved draft restored from this browser.' : '')
  const [phase, setPhase] = useState('')
  const [output, setOutput] = useState(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const active = useRef(true)
  const editor = useRef(null)
  const dirty = useRef(false)
  async function refreshCloud() {
    setSyncing(true); setCloudError('')
    try {
      const remote = await loadCloudPrograms()
      if (!active.current) return
      setCloudPrograms(remote)
      if (!dirty.current) {
        const latest = remote.find(item => item.id === programId) || (!programId ? remote.find(item => item.language === language) : null)
        if (latest && !opened?.pending) {
          setCode(latest.code); setInput(latest.input); setProgramName(latest.name); setProgramId(latest.id); setRevision(latest.revision)
          setMessage(`Opened “${latest.name}” from your account.`)
        }
      }
    } catch (failure) { if (active.current) setCloudError(failure.status === 401 ? 'Sign in again to access cloud saves.' : 'Cloud saves are unavailable. Browser copies are still available.') }
    finally { if (active.current) setSyncing(false) }
  }
  useEffect(() => { refreshCloud() }, [])
  const library = cloudError ? programs : mergeProgramLibrary(programs.filter(item => !item.revision || item.pending || cloudPrograms.some(remote => remote.id === item.id)), cloudPrograms)
  function cacheCloud(program) {
    try { saveNamedProgram(window.localStorage, account, { ...program, pending: false }) } catch { /* A cloud success remains valid even if browser storage is full. */ }
    setCloudPrograms(list => [program, ...list.filter(item => item.id !== program.id)])
    setPrograms(listSavedPrograms(window.localStorage, account, languages))
  }
  async function upload(program) {
    setSyncing(true)
    try {
      const prepared = saveNamedProgram(window.localStorage, account, { ...program, pending: true })
      const saved = await putCloudProgram(prepared)
      cacheCloud(saved); setCloudError(''); setMessage(`“${saved.name}” saved to your account.`)
      if (programId === program.id) { setProgramId(saved.id); setRevision(saved.revision) }
    } catch (failure) { setMessage(failure.message || 'Upload failed. Your browser copy is kept.') }
    finally { setSyncing(false) }
  }
  useEffect(() => {
    if (focusEditor && editor.current) {
      editor.current.focus({ preventScroll: true })
      editor.current.scrollIntoView({ block: 'center', behavior: 'instant' })
    }
  }, [focusEditor])
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const web = ['html', 'css', 'jsx'].includes(challenge.runtime)
  const stdin = Boolean(compiled)
  function edit(setter, value) { dirty.current = true; setter(value); setMessage('Unsaved changes'); setError(''); setOutput(null); setPreview('') }
  function manage(type, program) { setManagement({ type, program, name: program.name }); setManagementError('') }
  async function confirmManagement(event) {
    event.preventDefault()
    try {
      setSyncing(true)
      if (management.type === 'rename') {
        const renamed = management.program.cloud || management.program.revision ? await putCloudProgram({ ...management.program, name: management.name }) : renameSavedProgram(window.localStorage, account, management.program.id, management.name, languages)
        if (management.program.cloud || management.program.revision) cacheCloud(renamed)
        if (programId === management.program.id) { setProgramName(renamed.name); setProgramId(renamed.id); setRevision(renamed.revision || 0) }
        setMessage(`Renamed to “${renamed.name}”.`)
      } else {
        const deleted = management.program
        if (deleted.cloud || deleted.revision) await removeCloudProgram(deleted)
        if (programs.some(item => item.id === deleted.id)) deleteSavedProgram(window.localStorage, account, deleted.id, languages)
        setCloudPrograms(list => list.filter(item => item.id !== deleted.id))
        if (programId === deleted.id) { setProgramId(null); setRevision(0) }
        setMessage(`Deleted saved program “${deleted.name}”. Any code currently in the editor is kept.`)
      }
      setPrograms(listSavedPrograms(window.localStorage, account, languages)); setManagement(null)
    } catch (failure) { setManagementError(failure.message || 'Unable to update saved programs.') }
    finally { setSyncing(false) }
  }
  async function save() {
    setSyncing(true)
    try {
      const saved = saveNamedProgram(window.localStorage, account, { id: programId, name: programName, language, code, input, ...(programId ? { revision } : {}), pending: true })
      setProgramId(saved.id); setProgramName(saved.name)
      if (!savePlaygroundDraft(window.localStorage, key, { code, input })) throw new Error('Save failed')
      setPrograms(listSavedPrograms(window.localStorage, account, languages))
      window.localStorage.setItem(`quizly-playground-${account}-language`, language)
      try {
        const remote = await putCloudProgram(saved)
        cacheCloud(remote); setRevision(remote.revision); dirty.current = false; setCloudError('')
        setMessage(`Saved “${remote.name}” to your account. Available on your other devices.`)
      } catch (failure) { setMessage(`Saved in this browser only. ${failure.status === 409 ? failure.message : 'Cloud save failed. Use Upload to retry.'}`) }
    } catch (failure) { setMessage(failure.message || 'Unable to save. Copy your code to keep it.') }
    finally { setSyncing(false) }
  }
  async function run() {
    if (running) return
    setRunning(true); setError(''); setOutput(null); setPreview('')
    try {
      let parsed = null
      if (!web && !stdin) { try { parsed = JSON.parse(input) } catch { throw new Error('Input must be valid JSON.') } }
      const testCases = web ? [] : [{ name: 'Output', input: parsed, stdin: stdin ? input : undefined, expected: null }]
      const result = await runSubjectChallenge({ ...challenge, testCases, playground: true }, code, value => { if (active.current) setPhase(value) })
      if (active.current) { setOutput(result.results); setPreview(result.preview || '') }
    } catch (failure) { if (active.current) setError(failure.message) }
    finally { if (active.current) setRunning(false) }
  }
  const instructions = web ? challenge.runtime === 'css' ? 'Style the sample .card containing a heading, email input, and button. Run code to preview your CSS.' : challenge.runtime === 'jsx' ? 'Define an App component in JSX. React is provided; the preview renders its initial markup.' : 'Write HTML and run code to preview it. Scripts are disabled in previews.' : stdin ? 'Write a complete program and print your answer to standard output.' : challenge.runtime === 'sql' ? 'Write a SQLite query. Edit the sales rows in the JSON input below.' : challenge.runtime === 'mongodb' ? 'Enter a MongoDB JSON aggregation pipeline. Edit the sample documents below.' : 'JavaScript: use console.log() to print output; JSON input is available as input. Python: use print() to print output. You can also define solve(input) and return a value.'
  return <main className="coding-hub coding-playground">
    <button className="coding-back" onClick={onBack} disabled={running || syncing}><ArrowLeft size={18} />Coding Practice</button>
    <div className="coding-hub-heading"><div><p className="eyebrow">Make room for practice</p><h1>Coding Playground</h1><p>Write freely, run your code, and save your draft.</p></div><button className="button button-quiet" onClick={save} disabled={syncing}><Save size={16} />Save code</button></div>
    <div className="coding-filters"><label htmlFor="playground-language">Language<select id="playground-language" value={language} disabled={running || syncing} onChange={event => onLanguage(event.target.value)}>{languages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><p role="status">{message || 'Drafts are saved separately for each language.'}</p></div>
    <div className="playground-programs">
      <label htmlFor="program-name">Program name<input id="program-name" maxLength={80} placeholder="e.g. Array practice" value={programName} onChange={event => setProgramName(event.target.value)} /></label>
      <label htmlFor="saved-programs">Saved programs<select id="saved-programs" value="" disabled={running || syncing} onChange={event => { const program = library.find(item => item.id === event.target.value); if (program && languages.some(([id]) => id === program.language)) onOpen(program) }}><option value="">Open a saved program ({library.length})</option>{library.map(item => <option key={item.id} value={item.id}>{item.name} · {languages.find(([id]) => id === item.language)?.[1] || item.language}</option>)}</select></label>
      <button className="button button-quiet" disabled={running || syncing} onClick={() => { setProgramId(null); setRevision(0); setProgramName(''); edit(setCode, defaults[language][0]); setInput(defaults[language][1]) }}>New program</button>
    </div>
    <section className="playground-saved-list" aria-label="Saved programs library">
      <h2>Saved programs ({library.length})</h2>
      <p role="status">{syncing ? 'Syncing your account…' : cloudError || 'Cloud saves are connected.'}</p>
      <button className="button button-quiet" disabled={syncing || running} onClick={refreshCloud}>Refresh cloud saves</button>
      {library.length === 0 ? <p className="muted">No saved programs found for this account in this browser.</p> : library.map(program => <article key={program.id}>
        <div><strong>{program.name}</strong><small>{languages.find(([id]) => id === program.language)?.[1] || program.language} · {program.pending ? 'Browser copy · upload pending' : program.cloud ? 'Cloud saved' : 'Browser only'}</small></div>
        <div className="program-actions">
          {program.pending && cloudPrograms.some(remote => remote.id === program.id) && <button className="button button-quiet" disabled={syncing || running} onClick={() => onOpen(cloudPrograms.find(remote => remote.id === program.id))}>Open cloud version</button>}
          {(!program.cloud || program.pending) && <button className="button button-quiet" disabled={syncing || running} onClick={() => upload(program)} aria-label={`Upload ${program.name}`}>Upload</button>}
          <button className="button button-outline" disabled={running || syncing} onClick={() => onOpen(program)} aria-label={`Open ${program.name}`}>Open</button>
          <button className="button button-quiet" onClick={() => downloadProgram(program)} aria-label={`Download ${program.name}`}><Download size={15} />Download</button>
          <button className="button button-quiet" disabled={running || syncing} onClick={() => manage('rename', program)} aria-label={`Rename ${program.name}`}>Rename</button>
          <button className="button button-quiet program-delete" disabled={running || syncing} onClick={() => manage('delete', program)} aria-label={`Delete ${program.name}`}>Delete</button>
        </div>
      </article>)}
    </section>
    <p className="muted">{instructions}</p>
    {compiled && <p className="muted">You can write and save {challenge.language} programs now. Running this language requires compiler setup.</p>}
    <section className="coding-editor-panel" aria-label="Playground editor">
      <div className="coding-language-bar"><span className="coding-js-logo">{challenge.badge}</span><strong>{challenge.language}{programName ? ` · ${programName}` : ''}</strong><button className="icon-button" aria-label="Reset playground code" disabled={running || syncing} onClick={() => { edit(setCode, defaults[language][0]); setInput(defaults[language][1]) }}><RotateCcw size={18} /></button></div>
      <label className="sr-only" htmlFor="playground-code">{challenge.language} playground editor</label><textarea ref={editor} id="playground-code" className="coding-code-input playground-code" value={code} disabled={running || syncing} spellCheck={false} onChange={event => edit(setCode, event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run() } }} />
      <div className="coding-run-bar"><span aria-live="polite">{running ? phase : '3-second execution limit · Ctrl+Enter to run'}</span><button className="button button-quiet" onClick={() => downloadProgram({ name: programName, language, code })}><Download size={16} />Download code</button><button className="button button-primary" disabled={running || syncing} onClick={run}><Play size={16} />{running ? 'Running…' : 'Run code'}</button></div>
    </section>
    {!web && <label className="playground-input-label" htmlFor="playground-input">{stdin ? 'Standard input' : 'JSON input'}<textarea id="playground-input" value={input} disabled={running || syncing} spellCheck={false} onChange={event => edit(setInput, event.target.value)} /></label>}
    <section className="playground-output" aria-label="Playground output"><h2>{web ? 'Preview' : 'Output'}</h2><div aria-live="polite">{error && <p role="alert" className="form-error">{error}</p>}{output?.map(item => <pre className="coding-reference" key={item.name}>{item.error || (typeof item.actual === 'string' ? item.actual : JSON.stringify(item.actual, null, 2))}</pre>)}{preview && <iframe title="Playground preview" sandbox="allow-same-origin" srcDoc={preview} />}{!output && !error && <p className="muted">Run your code to see {web ? 'a preview' : 'the output'}.</p>}</div></section>
    <p className="coding-local-note">Cloud-saved programs are available wherever you sign in. Older browser saves stay here until you upload them. Save changes before leaving the page.</p>
    {management && <div className="modal-backdrop" onKeyDown={event => { if (event.key === 'Escape') setManagement(null) }}><form className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="manage-program-title" onSubmit={confirmManagement}>
      <h2 id="manage-program-title">{management.type === 'rename' ? 'Rename program' : 'Delete saved program?'}</h2>
      {management.type === 'rename' ? <label className="field-label">New program name<input autoFocus required maxLength={80} value={management.name} onChange={event => setManagement({ ...management, name: event.target.value })} /></label> : <p>Delete “{management.program.name}” {management.program.cloud ? 'from your account on all devices' : 'from this browser'}? This cannot be undone. Any code currently in the editor will stay there.</p>}
      {managementError && <p role="alert" className="form-error">{managementError}</p>}
      <div className="modal-actions"><button disabled={syncing} autoFocus={management.type === 'delete'} type="button" className="button button-quiet" onClick={() => setManagement(null)}>Cancel</button><button disabled={syncing} type="submit" className="button button-primary">{management.type === 'rename' ? 'Save name' : 'Delete program'}</button></div>
    </form></div>}
  </main>
}
