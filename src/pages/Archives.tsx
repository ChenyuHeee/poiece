import { useStore } from '../store'
import { ArrowLeft, Trash2, RotateCcw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

export default function Archives() {
  const archives = useStore((s) => s.archives)
  const removeArchive = useStore((s) => s.removeArchive)
  const restoreArchive = useStore((s) => s.restoreArchive)
  const navigate = useNavigate()

  return (
    <div className="h-full overflow-y-auto px-4 py-4 max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-ink-dim hover:text-ink transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-xl italic font-semibold text-ink" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          archives
        </h1>
      </div>

      {archives.length === 0 ? (
        <div className="text-center py-16 text-ink-dim/30 italic">
          <p>no archives yet</p>
          <p className="text-xs mt-1">click &quot;archive all&quot; on the canvas to save a session</p>
        </div>
      ) : (
        <div className="space-y-2">
          {archives.map((archive) => (
            <div
              key={archive.id}
              className="workshop-sheet p-3 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink truncate italic">{archive.name}</p>
                <p className="text-xs text-ink-dim/40">
                  {archive.inspirations.length} fragments ·{' '}
                  {new Date(archive.createdAt).toLocaleString('zh-CN', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    restoreArchive(archive.id)
                    navigate('/')
                  }}
                  className="p-1.5 text-ink-dim/40 hover:text-amber transition-colors cursor-pointer"
                  title="restore"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => removeArchive(archive.id)}
                  className="p-1.5 text-ink-dim/30 hover:text-redink transition-colors cursor-pointer"
                  title="delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
