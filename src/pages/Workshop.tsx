import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { agents } from '../agents/defs'
import { callLLM, getSettings } from '../lib/llm'
import { Loader2, Trash2, Copy, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

export default function Workshop() {
  const inspirations = useStore((s) => s.inspirations)
  const poems = useStore((s) => s.poems)
  const savePoem = useStore((s) => s.savePoem)
  const removePoem = useStore((s) => s.removePoem)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
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
      const result = await callLLM(structAgent.systemPrompt, structAgent.userPromptTemplate(selectedFragments, context))
      setPoemContent(poemContent ? poemContent + '\n\n--- 结构建议 ---\n' + result : result)
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
      <h1 className="text-2xl font-semibold text-ink-900 mb-2">诗歌工坊</h1>
      <p className="text-ink-500 text-sm mb-6">
        选择灵感碎片，拼贴、组合、锤炼成一首完整的诗。
      </p>

      {inspirations.length === 0 ? (
        <div className="text-center py-16 text-ink-300">
          <p>还没有灵感碎片</p>
          <p className="text-sm mt-1">先去「灵感」页面记录一些碎片吧</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Fragment selector */}
          <div className="lg:col-span-2 space-y-2">
            <h2 className="text-sm font-medium text-ink-500 mb-3">选择碎片</h2>
            {inspirations.map((insp) => (
              <button
                key={insp.id}
                onClick={() => toggleSelect(insp.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedIds.has(insp.id)
                    ? 'border-accent bg-accent/5'
                    : 'border-ink-200 bg-white/40 hover:border-ink-300'
                }`}
              >
                <p className="text-sm text-ink-800 line-clamp-2">{insp.content}</p>
                <span className="text-xs text-ink-400 mt-1">
                  {new Date(insp.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </button>
            ))}
          </div>

          {/* Right: Poem canvas */}
          <div className="lg:col-span-3 space-y-4">
            <div className="card p-4">
              <div className="flex items-center gap-3 mb-3">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ink-100 text-ink-700 rounded-lg text-sm hover:bg-ink-200 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
                  >
                    {loading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    结构建议
                  </button>
                )}
              </div>
              <textarea
                value={poemContent}
                onChange={(e) => setPoemContent(e.target.value)}
                placeholder="在此拼贴和创作你的诗..."
                rows={16}
                className="w-full resize-none bg-transparent text-ink-900 placeholder-ink-300 poem-text text-base outline-none"
              />
              {error && (
                <p className="text-sm text-red-500 mt-2 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-ink-200">
                <span className="text-xs text-ink-400">
                  {selectedIds.size} 个碎片已选
                </span>
                <button
                  onClick={handleSave}
                  disabled={!poemContent.trim()}
                  className="px-5 py-1.5 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-default hover:bg-accent/90"
                >
                  保存诗稿
                </button>
              </div>
            </div>

            {/* Saved poems */}
            {poems.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-ink-500 mb-3">
                  已存诗稿 ({poems.length})
                </h2>
                <div className="space-y-2">
                  {poems.map((poem) => (
                    <div key={poem.id} className="card p-3">
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
                            onClick={() => {
                              navigator.clipboard.writeText(poem.content)
                            }}
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
