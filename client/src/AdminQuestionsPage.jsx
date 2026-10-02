import { useState } from 'react'
import { ArrowLeft, BookOpenCheck } from 'lucide-react'
import { EmptyState } from './components/ui.jsx'

const blankQuestion = () => ({ text: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' })
const questionId = question => question._id || question.id

export default function AdminQuestionsPage({ quizzes, onLoadQuiz, onSaveQuestion, onDeleteQuestion, onNavigate }) {
  const [selectedQuiz, setSelectedQuiz] = useState(null)
  const [draft, setDraft] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
