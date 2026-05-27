import { NavLink, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="h-svh flex flex-col overflow-hidden">
      <header className="header-bar shrink-0">
        <div className="px-4 h-12 flex items-center justify-between">
          <span className="text-xl italic font-semibold tracking-wide text-ink" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
            Poiece
          </span>
          <nav className="flex items-center gap-1">
            {[
              ['/', '灵感'],
              ['/workshop', '工坊'],
              ['/settings', '设置'],
            ].map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `nav-link px-2.5 py-1 text-xs ${isActive ? 'active' : 'text-ink-dim hover:text-ink'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
