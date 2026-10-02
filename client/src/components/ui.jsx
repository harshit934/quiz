import { useEffect } from 'react'
import {
  Atom, BarChart3, BookOpen, Brain, Braces, Check, CheckCircle2, ChevronRight,
  CircleHelp, Clock3, Code2, Compass, Globe2, Layers3, LayoutTemplate,
  LoaderCircle, Paintbrush2, Sparkles, Terminal, Trophy, X,
} from 'lucide-react'

const icons = {
  atom: Atom,
  'chart-no-axes-combined': BarChart3,
  'code-2': Code2,
  'globe-2': Globe2,
  layers: Layers3,
  'panels-top-left': LayoutTemplate,
  paintbrush: Paintbrush2,
  terminal: Terminal,
  brain: Brain,
  braces: Braces,
  book: BookOpen,
  compass: Compass,
  sparkles: Sparkles,
  trophy: Trophy,
}

export function CategoryIcon({ name, size = 18, className = '', style }) {
  const Icon = icons[name] || CircleHelp
  return <Icon aria-hidden="true" className={className} size={size} strokeWidth={1.8} style={style} />
}

export function Badge({ children, tone = 'neutral' }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function QuizCard({ quiz, onStart, compact = false }) {
  return (
    <article className={`quiz-card ${compact ? 'quiz-card-compact' : ''}`}>
      <div className="quiz-card-topline">
        <span className="category-mark" style={{ '--category-color': quiz.category?.color || 'var(--accent)' }}>
          <CategoryIcon name={quiz.category?.icon} size={19} />
        </span>
        <Badge tone={quiz.difficulty?.toLowerCase()}>{quiz.difficulty}</Badge>
      </div>
      <div className="quiz-card-copy">
        <p className="eyebrow">{quiz.category?.name || 'General knowledge'}</p>
        <h3>{quiz.title}</h3>
        <p className="muted quiz-description">{quiz.description}</p>
      </div>
      <div className="quiz-meta">
        <span><BookOpen size={15} /> {quiz.totalQuestions || quiz.questions?.length || 0} questions</span>
        <span><Clock3 size={15} /> {quiz.timeLimit} min</span>
      </div>
      <button className="button button-quiet quiz-start" onClick={() => onStart(quiz)}>
        Start quiz <ChevronRight size={16} />
      </button>
    </article>
  )
}

export function StatCard({ icon: Icon = BarChart3, label, value, detail, accent = 'violet' }) {
  return (
    <article className={`stat-card stat-${accent}`}>
      <span className="stat-icon"><Icon size={18} /></span>
      <div><p className="muted stat-label">{label}</p><strong>{value}</strong>{detail && <p className="stat-detail">{detail}</p>}</div>
    </article>
  )
}

export function EmptyState({ icon: Icon = CircleHelp, title, detail, action }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon size={22} /></span>
      <h3>{title}</h3>
      <p className="muted">{detail}</p>
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Loading your workspace' }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spin" size={22} /> <span>{label}</span></div>
}

export function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return undefined
    const timeout = window.setTimeout(onClose, 3400)
    return () => window.clearTimeout(timeout)
  }, [message, onClose])

  if (!message) return null
  return <div className="toast" role="status"><CheckCircle2 size={18} /><span>{message}</span><button aria-label="Dismiss notification" onClick={onClose}><X size={16} /></button></div>
}

export function ConfirmDialog({ title, detail, confirmLabel = 'Confirm submission', onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && onCancel()}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <button className="icon-button modal-close" aria-label="Close dialog" onClick={onCancel}><X size={18} /></button>
        <span className="modal-symbol"><Check size={20} /></span>
        <p className="eyebrow">One last check</p>
        <h2 id="dialog-title">{title}</h2>
        <p className="muted">{detail}</p>
        <div className="modal-actions">
          <button className="button button-quiet" onClick={onCancel}>Keep working</button>
          <button className="button button-primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}