import { useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { agents } from '../agents/defs'
import { callLLM, getSettings, formatAgentItems } from '../lib/llm'
import { Loader2, Trash2, Copy, Sparkles, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

const floatClasses = ['bubble-float-a', 'bubble-float-b', 'bubble-float-c', 'bubble-float-d']

function seedFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

export default function Workshop() {
  const location = useLocation()
  const preSelected = (location.state as any)?.preSelected as string[] | undefined

  const inspirations = useStore((s) => s.inspirations)
  const poems = useStore((s) => s.poems)
  const savePoem = useStore((s) => s.savePoem)
  const removePoem = useStore((s) => s.removePoem)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(preSelected || [])
  )
  const [poemContent, setPoemContent] = useState('')
  const [poemTitle, setPoemTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedPoem, setExpandedPoem] = useState<string | null>(null)

  const selectedFragments = useMemo(() => {
    return inspirations
      .filter((i) => selectedIds.has(i.id))
      .map((i) => i.content)
      .join('\n')
  }, [inspirations, selectedIds])

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleAssemble = async () => {
    if (selectedIds.size === 0) return
    const structAgent = agents.find((a) => a.id === 'structure')!
    const context = poems.length > 0 ? '已有作品：' + poems.slice(0, 3).map((p) => p.title).join('、') : ''
    setLoading(true)
    setError('')
    try {
      const raw = await callLLM(structAgent.systemPrompt, structAgent.userPromptTemplate(selectedFragments, context))
      const formatted = formatAgentItems(raw)
      setPoemContent(poemContent ? poemContent + '\n\n--- 结构建议 ---\n' + formatted : formatted)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!poemContent.trim()) return
    savePoem(poemTitle || '未命名', poemContent, [...selectedIds])
    setPoemTitle('')
    setPoemContent('')
    setSelectedIds(new Set())
  }

  const hasApiKey = !!getSettings().apiKey

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-ink-400 hover:text-ink-600 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-semibold text-ink-900">将碎片拼成诗</h1>
      </div>

      {inspirations.length === 0 ? (
        <div className="text-center py-16 text-ink-300">
          <p>还没有灵感碎片</p>
          <p className="text-sm mt-1">先回去捕捉一些思绪吧</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Fragment bubbles to select */}
          <div className="lg:col-span-2">
            <p className="text-xs text-ink-400 mb-3">
              点击气泡选择碎片（已选 {selectedIds.size} 个）
            </p>
            <div className="flex flex-wrap gap-2">
              {inspirations.map((insp) => {
                const seed = seedFromId(insp.id)
                const floatClass = floatClasses[seed % floatClasses.length]
                const isSelected = selectedIds.has(insp.id)
                return (
                  <button
                    key={insp.id}
                    onClick={() => toggleSelect(insp.id)}
                    className={`bubble bubble-mine ${isSelected ? 'bubble-selected bubble-float-stop' : floatClass}`}
                    style={{ fontSize: '0.85rem', padding: '6px 14px' }}
                  >
                    {insp.content.slice(0, 24)}
                    {insp.content.length > 24 ? '…' : ''}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right: Poem canvas */}
          <div className="lg:col-span-3 space-y-4">
            <div
              className="p-5 rounded-2xl border border-ink-200"
              style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="text"
                  value={poemTitle}
                  onChange={(e) => setPoemTitle(e.target.value)}
                  placeholder="诗题"
                  className="flex-1 bg-transparent text-lg font-semibold text-ink-900 outline-none placeholder-ink-300"
                />
                {hasApiKey && (
                  <button
                    onClick={handleAssemble}
                    disabled={selectedIds.size === 0 || loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-100 text-ink-700 rounded-full text-xs hover:bg-ink-200 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
                  >
                    {loading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    结构建议
                  </button>
                )}
              </div>
              <textarea
                value={poemContent}
                onChange={(e) => setPoemContent(e.target.value)}
                placeholder="在此拼贴和创作..."
                rows={14}
                className="w-full resize-none bg-transparent text-ink-900 placeholder-ink-300 poem-text text-base outline-none"
              />
              {error && (
                <p className="text-sm text-red-500 mt-2 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex justify-end mt-3 pt-3 border-t border-ink-200">
                <button
                  onClick={handleSave}
                  disabled={!poemContent.trim()}
                  className="px-5 py-1.5 bg-accent text-white rounded-full text-sm font-medium disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-default hover:bg-accent/90"
                >
                  保存诗稿
                </button>
              </div>
            </div>

            {/* Saved poems */}
            {poems.length > 0 && (
              <div>
                <p className="text-xs text-ink-400 mb-3">已存诗稿 ({poems.length})</p>
                <div className="space-y-2">
                  {poems.map((poem) => (
                    <div
                      key={poem.id}
                      className="rounded-xl border border-ink-200 p-3"
                      style={{ background: 'rgba(255,255,255,0.4)' }}
                    >
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() =>
                            setExpandedPoem(expandedPoem === poem.id ? null : poem.id)
                          }
                          className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <span className="font-medium text-ink-800 truncate">
                            {poem.title || '未命名'}
                          </span>
                          <span className="text-xs text-ink-400">
                            {new Date(poem.updatedAt).toLocaleDateString('zh-CN')}
                          </span>
                          {expandedPoem === poem.id ? (
                            <ChevronUp size={14} className="text-ink-400 shrink-0" />
                          ) : (
                            <ChevronDown size={14} className="text-ink-400 shrink-0" />
                          )}
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => navigator.clipboard.writeText(poem.content)}
                            className="p-1 text-ink-400 hover:text-ink-600 transition-colors cursor-pointer"
                            title="复制"
                          >
                            <Copy size={14} />
                          </button>
                          <button
                            onClick={() => removePoem(poem.id)}
                            className="p-1 text-ink-300 hover:text-red-500 transition-colors cursor-pointer"
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {expandedPoem === poem.id && (
                        <div className="mt-3 pt-3 border-t border-ink-200">
                          <p className="text-sm text-ink-700 poem-text whitespace-pre-wrap">
                            {poem.content}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
