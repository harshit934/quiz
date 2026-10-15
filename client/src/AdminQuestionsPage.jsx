import { useState } from 'react'
import { ArrowLeft, BookOpenCheck } from 'lucide-react'
import { EmptyState } from './components/ui.jsx'
import { request } from './services/api.js'

const blankQuestion = () => ({ text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' })
const questionId = question => question._id || question.id

export default function AdminQuestionsPage({ quizzes, onLoadQuiz, onSaveQuestion, onDeleteQuestion, onNavigate }) {
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const [draft, setDraft] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importError, setImportError] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importResult, setImportResult] = useState(null)

  async function readImportFile(file) {
    setImportFile(null)
    setImportPreview(null)
    setImportResult(null)
    setImportError('')
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'json'].includes(extension) || file.size > 700_000) {
      setImportError('Choose a CSV or JSON file smaller than 700 KB.')
      return
    }
    try {
      setImportFile({ name: file.name, format: extension, content: await file.text() })
    } catch (fileError) {
      setImportError(`The file could not be read. ${fileError.message}`)
    }
  }

  async function previewImport() {
    if (!importFile) return
    setImportBusy(true)
    setImportError('')
    setImportPreview(null)
    setImportResult(null)
    try {
      const preview = await fetchImport('/preview')
      setImportPreview(preview)
    } catch (previewError) {
      setImportError(previewError.message)
    } finally {
      setImportBusy(false)
    }
  }

  async function commitImport() {
    if (!importFile || !importPreview?.valid) return
    setImportBusy(true)
    setImportError('')
    try {
      const result = await fetchImport('/commit')
      setImportResult(result)
      setImportPreview(null)
      setImportFile(null)
      if (selectedQuiz) {
        try {
          setSelectedQuiz(await onLoadQuiz(selectedQuiz))
        } catch (refreshError) {
          setImportError(`Questions were imported, but the current list could not refresh. ${refreshError.message}`)
        }
      }
    } catch (commitError) {
      setImportError(commitError.message)
    } finally {
      setImportBusy(false)
    }
  }

  async function fetchImport(action) {
    return request(`/admin/questions/import${action}`, {
      method: 'POST',
      body: JSON.stringify({ format: importFile.format, content: importFile.content }),
    })
  }

  async function chooseQuiz(quiz) {
    setLoading(true)
    setError('')
    setDraft(null)
    try { setSelectedQuiz(await onLoadQuiz(quiz)) }
    catch (loadError) { setError(loadError.message) }
    finally { setLoading(false) }
  }

  async function saveQuestion(event) {
    event.preventDefault()
    if (!selectedQuiz || !draft) return
    setSaving(true)
    setError('')
    try {
      await onSaveQuestion(selectedQuiz._id, draft, editingId)
      setSelectedQuiz(await onLoadQuiz(selectedQuiz))
      setDraft(null)
      setEditingId(null)
    } catch (saveError) { setError(saveError.message) }
    finally { setSaving(false) }
  }

  async function deleteQuestion(question) {
    if (!selectedQuiz || !window.confirm('Delete this question? Existing quiz history will remain unchanged.')) return
    setError('')
    try {
      await onDeleteQuestion(selectedQuiz._id, questionId(question))
      setSelectedQuiz(await onLoadQuiz(selectedQuiz))
    } catch (deleteError) { setError(deleteError.message) }
  }

  return (
    <main className="admin-questions-page page-width page-main">
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">Question bank</p>
          <h1>Manage Questions</h1>
          <p className="muted">Create, edit, and remove quiz questions.</p>
        </div>
        <button className="button button-quiet" onClick={() => onNavigate('#admin/quizzes')}><ArrowLeft size={15} /> Manage quizzes</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="admin-table-panel admin-import-panel" aria-labelledby="bulk-import-title">
        <div className="admin-table-heading"><div><p className="eyebrow">Question bank</p><h2 id="bulk-import-title">Bulk import</h2></div></div>
        <p className="muted">Preview a JSON batch or CSV rows. Each row must match an existing quiz by category slug, exact title, and difficulty. CSV headers: categorySlug,title,difficulty,text,optionA,optionB,optionC,optionD,correctAnswer,explanation (answer key A–D or 0–3).</p>
        <label className="field-label">CSV or JSON file<input type="file" accept=".csv,.json,text/csv,application/json" onChange={event => readImportFile(event.target.files?.[0])} /></label>
        {importFile && <p role="status">Selected: {importFile.name}</p>}
        {importError && <p className="form-error" role="alert">{importError}{importError.details?.map(item => <span key={`${item.path}-${item.row}`}>{item.row ? ` Row ${item.row}: ` : ' '}{item.path} {item.message}</span>)}</p>}
        {importPreview && <div className="admin-import-preview" aria-live="polite">
          <p>{importPreview.valid ? `${importPreview.questionCount} new questions across ${importPreview.quizCount} quizzes are ready to import.` : 'Resolve these validation issues, then select and preview the corrected file.'}</p>
          {importPreview.errors?.map((item, index) => <p className="form-error" key={`${item.path}-${index}`}>{item.row ? `Row ${item.row}: ` : ''}{item.path} {item.message}</p>)}
          {importPreview.duplicates?.flatMap(quiz => quiz.questions.map(text => <p className="muted" key={`${quiz.categorySlug}-${quiz.title}-${text}`}>Already exists and will be skipped: {text} ({quiz.title})</p>))}
        </div>}
        {importResult && <p className="admin-import-success" role="status">Imported {importResult.insertedQuestionCount} questions. Existing duplicate questions were skipped.</p>}
        <div className="admin-question-actions">
          <button className="button button-quiet" disabled={!importFile || importBusy} onClick={previewImport}>{importBusy ? 'Working…' : 'Preview import'}</button>
          <button className="button button-primary" disabled={!importPreview?.valid || importBusy} onClick={commitImport}>Import validated questions</button>
        </div>
      </section>
      {!selectedQuiz ? (
        <section className="admin-table-panel">
          <div className="admin-table-heading">
            <div><p className="eyebrow">Quiz library</p><h2>Choose a quiz</h2></div>
            <BookOpenCheck size={20} />
          </div>
          {loading ? <p className="muted" role="status">Loading quiz questions…</p> : quizzes.length ? (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead><tr><th>Quiz</th><th>Subject</th><th>Difficulty</th><th>Questions</th><th>Action</th></tr></thead>
                <tbody>{quizzes.map(quiz => (
                  <tr key={quiz._id}>
                    <td><strong>{quiz.title}</strong></td>
                    <td>{quiz.category?.name || 'Uncategorized'}</td>
                    <td>{quiz.difficulty}</td>
                    <td>{quiz.totalQuestions}</td>
                    <td><button className="button button-quiet admin-small-action" onClick={() => chooseQuiz(quiz)}>Manage questions</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="No quizzes available" detail="Create a quiz before adding questions." />}
        </section>
      ) : (
        <section className="admin-question-workspace">
          <div className="admin-table-heading">
            <div><p className="eyebrow">{selectedQuiz.category?.name || 'Quiz'}</p><h2>{selectedQuiz.title}</h2></div>
            <button className="button button-quiet" onClick={() => { setSelectedQuiz(null); setDraft(null); setEditingId(null) }}>Choose another quiz</button>
          </div>
          <section className="admin-table-panel admin-question-editor">
            <div className="admin-question-heading">
              <div><p className="eyebrow">{editingId ? 'Edit question' : 'New question'}</p><h3>{editingId ? 'Update question' : 'Add a question'}</h3></div>
            </div>
            <form onSubmit={saveQuestion} className="admin-question-form">
              <label className="field-label">Question text<textarea required minLength={5} maxLength={500} rows="2" value={draft?.text || ''} onChange={event => setDraft(value => ({ ...(value || blankQuestion()), text: event.target.value }))} /></label>
              <div className="admin-options-grid">{(draft?.options || blankQuestion().options).map((option, index) => (
                <label className="field-label" key={index}>Option {String.fromCharCode(65 + index)}<input required maxLength={180} value={option} onChange={event => setDraft(value => ({ ...(value || blankQuestion()), options: (value?.options || blankQuestion().options).map((answer, answerIndex) => answerIndex === index ? event.target.value : answer) }))} /></label>
              ))}</div>
              <label className="field-label">Correct answer<select value={draft?.correctAnswer ?? 0} onChange={event => setDraft(value => ({ ...(value || blankQuestion()), correctAnswer: Number(event.target.value) }))}>{(draft?.options || blankQuestion().options).map((option, index) => <option key={index} value={index}>{String.fromCharCode(65 + index)} · {option || 'Option text'}</option>)}</select></label>
              <label className="field-label">Explanation <span className="optional-label">(optional)</span><textarea rows="2" maxLength={500} value={draft?.explanation || ''} onChange={event => setDraft(value => ({ ...(value || blankQuestion()), explanation: event.target.value }))} /></label>
              <div className="admin-question-actions">
                <button className="button button-primary" type="submit" disabled={saving || !draft}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Create question'}</button>
                {draft && <button className="button button-quiet" type="button" onClick={() => { setDraft(null); setEditingId(null) }}>Cancel</button>}
                {!draft && <button className="button button-quiet" type="button" onClick={() => { setDraft(blankQuestion()); setEditingId(null) }}>New question</button>}
              </div>
            </form>
          </section>
          <section className="admin-table-panel">
            <div className="admin-table-heading"><div><p className="eyebrow">{selectedQuiz.questions?.length || 0} total</p><h2>Questions</h2></div></div>
            {selectedQuiz.questions?.length ? <div className="admin-question-list">{selectedQuiz.questions.map((question, index) => (
              <article className="admin-question-row" key={questionId(question)}>
                <div><strong>{index + 1}. {question.text}</strong><small>{question.options?.length || 0} answer options</small></div>
                <div className="table-actions">
                  <button onClick={() => { setDraft({ text: question.text, options: [...question.options], correctAnswer: question.correctAnswer ?? 0, explanation: question.explanation || '' }); setEditingId(questionId(question)) }}>Edit</button>
                  <button className="table-delete" onClick={() => deleteQuestion(question)}>Delete</button>
                </div>
              </article>
            ))}</div> : <EmptyState title="No questions yet" detail="Add the first question above." />}
          </section>
        </section>
      )}
    </main>
  )
}
