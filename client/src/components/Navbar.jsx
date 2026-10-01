import { useState } from 'react'
import { BookOpenCheck, Menu, Shield, Trophy, UserRound, X } from 'lucide-react'

export default function Navbar({ user, route, navigate, onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const links = [
    { label: 'Home', route: '#home' },
    { label: 'Explore', route: '#explore' },
    { label: 'Leaderboard', route: '#leaderboard', icon: Trophy },
  ]
  if (user) links.push({ label: 'Dashboard', route: '#dashboard' })
  if (user?.role === 'admin') links.push({ label: 'Admin', route: '#admin', icon: Shield })

  function go(target) {
    navigate(target)
    setMenuOpen(false)
  }

  return (
    <header className="site-header">
      <div className="nav-inner">
        <button className="brand" onClick={() => go('#home')} aria-label="Quizly home">
          <span className="brand-mark"><BookOpenCheck size={18} /></span><span>quizly<span className="brand-period">.</span></span>
        </button>
        <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation">
          {links.map(({ label, route: target, icon: Icon }) => (
            <button className={`nav-link ${route === target ? 'nav-link-active' : ''}`} key={target} onClick={() => go(target)}>
              {Icon && <Icon size={15} />} {label}
            </button>
          ))}
          <div className="mobile-auth-actions">
            {user ? <button className="button button-quiet" onClick={() => { onLogout(); setMenuOpen(false) }}>Sign out</button> : <>
              <button className="button button-quiet" onClick={() => go('#login')}>Log in</button>
              <button className="button button-primary" onClick={() => go('#register')}>Create account</button>
            </>}
          </div>
        </nav>
        <div className="nav-actions">
          {user ? <>
            <button className="user-chip" onClick={() => go('#dashboard')} aria-label={`Open dashboard for ${user.name}`}>
              <span className="avatar avatar-small">{user.name?.slice(0, 1).toUpperCase()}</span><span>{user.name?.split(' ')[0]}</span>
            </button>
            <button className="icon-button signout-button" title="Sign out" aria-label="Sign out" onClick={onLogout}><UserRound size={16} /></button>
          </> : <>
            <button className="nav-login" onClick={() => go('#login')}>Log in</button>
            <button className="button button-primary nav-register" onClick={() => go('#register')}>Get started</button>
          </>}
        </div>
        <button className="menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
          {menuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>
    </header>
  )
}