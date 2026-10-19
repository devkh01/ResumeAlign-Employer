const NAV_ITEMS = [
  { id: 'dashboard',   icon: '⬛', label: 'Dashboard'   },
  { id: 'create-job',  icon: '➕', label: 'Create Job'   },
  { id: 'candidates',  icon: '👥', label: 'Candidates'   },
]

function Sidebar({ currentView, onNavigate }) {
  return (
    <aside className="sidebar">
      {/* Branding */}
      <div className="sidebar-brand">
        <div className="brand-logo">
          <div className="brand-icon">🎯</div>
          <span className="brand-name">ResumeAlign AI</span>
        </div>
        <p className="brand-tagline">Employer Shortlisting Platform</p>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <p className="nav-section-label">Main Menu</p>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${currentView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={currentView === item.id ? 'page' : undefined}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <p className="sidebar-footer-label">ResumeAlign AI</p>
        <p className="sidebar-footer-version">v0.1.0 — Foundation</p>
      </div>
    </aside>
  )
}

export default Sidebar
