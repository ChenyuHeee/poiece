import { NavLink, Outlet } from 'react-router-dom'
import { PenLine, Settings, Lightbulb } from 'lucide-react'

export default function Layout() {
  return (
    <div className="h-svh flex flex-col overflow-hidden">
      <header className="shrink-0 z-10 bg-parchment/80 backdrop-blur border-b border-ink-200">
        <div className="px-4 h-12 flex items-center justify-between">
          <NavLink to="/" className="text-lg font-semibold tracking-wide text-ink-900 no-underline">
            Poiece
          </NavLink>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs no-underline transition-colors ${
                  isActive ? 'bg-ink-100 text-ink-800' : 'text-ink-500 hover:text-ink-700'
                }`
              }
            >
              <Lightbulb size={14} />
              灵感
            </NavLink>
            <NavLink
              to="/workshop"
              className={({ isActive }) =>
                `flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs no-underline transition-colors ${
                  isActive ? 'bg-ink-100 text-ink-800' : 'text-ink-500 hover:text-ink-700'
                }`
              }
            >
              <PenLine size={14} />
              工坊
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs no-underline transition-colors ${
                  isActive ? 'bg-ink-100 text-ink-800' : 'text-ink-500 hover:text-ink-700'
                }`
              }
            >
              <Settings size={14} />
              设置
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  )
}
