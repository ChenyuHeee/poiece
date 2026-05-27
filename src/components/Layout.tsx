import { NavLink, Outlet } from 'react-router-dom'
import { PenLine, Settings, Lightbulb } from 'lucide-react'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 bg-parchment/80 backdrop-blur border-b border-ink-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <NavLink to="/" className="text-xl font-semibold tracking-wide text-ink-900 no-underline">
            Poiece
          </NavLink>
          <nav className="flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm no-underline transition-colors ${
                  isActive ? 'bg-ink-100 text-ink-800' : 'text-ink-500 hover:text-ink-700'
                }`
              }
            >
              <Lightbulb size={16} />
              灵感
            </NavLink>
            <NavLink
              to="/workshop"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm no-underline transition-colors ${
                  isActive ? 'bg-ink-100 text-ink-800' : 'text-ink-500 hover:text-ink-700'
                }`
              }
            >
              <PenLine size={16} />
              工坊
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm no-underline transition-colors ${
                  isActive ? 'bg-ink-100 text-ink-800' : 'text-ink-500 hover:text-ink-700'
                }`
              }
            >
              <Settings size={16} />
              设置
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="flex-1 px-4 py-6 max-w-3xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
