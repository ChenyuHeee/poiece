import { useState } from 'react'
import { useStore } from '../store'
import InspirationCard from '../components/InspirationCard'

export default function Home() {
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const addInspiration = useStore((s) => s.addInspiration)
  const inspirations = useStore((s) => s.inspirations)

  const handleAdd = () => {
    const trimmed = content.trim()
    if (!trimmed) return
    const tags = tagInput
      .split(/[,，\s]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    addInspiration(trimmed, tags)
    setContent('')
    setTagInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAdd()
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-ink-900 mb-2">捕捉灵感</h1>
        <p className="text-ink-500 text-sm mb-4">
          随时记下一个词、一句话、一个画面。AI 将帮你延展。
        </p>
        <div className="card p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="在此写下你的灵感碎片..."
            rows={3}
            className="w-full resize-none bg-transparent text-ink-900 placeholder-ink-300 text-base leading-relaxed outline-none poem-text"
          />
          <div className="flex items-center gap-3 mt-3">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="标签（逗号分隔）"
              className="flex-1 bg-ink-50 border border-ink-200 rounded-lg px-3 py-1.5 text-sm text-ink-700 outline-none focus:border-accent transition-colors"
            />
            <button
              onClick={handleAdd}
              disabled={!content.trim()}
              className="px-5 py-1.5 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-default hover:bg-accent/90"
            >
              记录
            </button>
          </div>
          <p className="text-xs text-ink-400 mt-2">Cmd/Ctrl + Enter 快速记录</p>
        </div>
      </div>

      {inspirations.length === 0 ? (
        <div className="text-center py-16 text-ink-300">
          <p className="text-lg">还没有灵感碎片</p>
          <p className="text-sm mt-1">写下第一句，开始创作之旅</p>
        </div>
      ) : (
        <div className="space-y-4">
          {inspirations.map((insp) => (
            <InspirationCard key={insp.id} inspiration={insp} />
          ))}
        </div>
      )}
    </div>
  )
}
