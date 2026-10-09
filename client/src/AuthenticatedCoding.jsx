import { useEffect, useRef, useState } from 'react'
import CodingPage from './CodingPage.jsx'
import CodingPlayground from './CodingPlayground.jsx'
import { LoadingState } from './components/ui.jsx'
import { request } from './services/api.js'

export default function AuthenticatedCoding({ user, onExpired, playground, navigate, bookmarkId }) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const expired = useRef(onExpired)
  expired.current = onExpired
  useEffect(() => {
    let active = true
    setError('')
    request('/users/profile').then(value => {
      if (active) setProfile(value)
    }).catch(failure => {
      if (!active) return
      if (failure.status === 401) expired.current()
      else setError('Unable to verify your login. Please try again.')
    })
    return () => { active = false }
  }, [retry])

  if (error) return <main className="page-width page-main"><p role="alert">{error}</p><button className="button button-primary" onClick={() => setRetry(value => value + 1)}>Try again</button></main>
  if (!profile) return <main className="page-width page-main"><LoadingState label="Verifying your login" /></main>
  return playground ? <CodingPlayground user={profile || user} onBack={() => navigate('#coding')} /> : <CodingPage user={profile || user} bookmarkId={bookmarkId} onPlayground={() => navigate('#coding/playground')} />
}
