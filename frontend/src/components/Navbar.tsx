import type { Page } from '../App'

interface NavbarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const tabs: { id: Page; label: string; icon: string }[] = [
  { id: 'home', label: 'Inicio', icon: '⬡' },
  { id: 'register', label: 'Registrar', icon: '◈' },
  { id: 'auth', label: 'Autenticar', icon: '◎' },
  { id: 'dashboard', label: 'Dashboard', icon: '◇' },
]

export default function Navbar({ currentPage, onNavigate }: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="nav-logo">
        <div className="logo-icon">◈</div>
        <span>SO3<span style={{ color: 'var(--accent-purple)' }}>-TCN</span></span>
      </div>

      <div className="nav-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${currentPage === tab.id ? 'active' : ''}`}
            onClick={() => onNavigate(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="nav-status">
        <div className="status-dot" />
        <span>Local · Midnight</span>
      </div>
    </nav>
  )
}
