import { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { agents } from '../agents/defs'
import { callLLM, getSettings, formatAgentItems } from '../lib/llm'
import { Loader2, Trash2, Copy, Sparkles, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Workshop() {
  const location = useLocation()
  const preSelected = (location.state as any)?.preSelected as string[] | undefined

  const inspirations = useStore((s) => s.inspirations)
  const poems = useStore((s) => s.poems)
  const savePoem = useStore((s) => s.savePoem)
  const removePoem = useStore((s) => s.removePoem)

  // Default to all fragments if no preSelected (e.g. page refresh)
  const allIds = useMemo(() => inspirations.map((i) => i.id), [inspirations])
  const effectiveIds = preSelected && preSelected.length > 0 ? preSelected : allIds

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(effectiveIds)
  )
  const [poemTitle, setPoemTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedPoem, setExpandedPoem] = useState<string | null>(null)

  // Build initial poem content from selected fragments
  const buildContent = () =>
    inspirations
      .filter((i) => selectedIds.has(i.id))
      .map((i) => i.content)
      .join('\n')

  const [poemContent, setPoemContent] = useState(buildContent)

  // Sync poem content when selectedIds change
  const selectedFragments = useMemo(
    () => inspirations.filter((i) => selectedIds.has(i.id)).map((i) => i.content).join('\n'),
    [inspirations, selectedIds]
  )

  // Update poem content when selected fragments change
  useEffect(() => {
    setPoemContent(selectedFragments)
  }, [selectedFragments])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAssemble = async () => {
    if (selectedIds.size === 0) return
    const structAgent = agents.find((a) => a.id === 'structure')!
    setLoading(true)
    setError('')
    try {
      const raw = await callLLM(
        structAgent.systemPrompt,
        structAgent.userPromptTemplate(selectedFragments, ''),
        undefined
      )
      const formatted = formatAgentItems(raw)
      setPoemContent((prev) => (prev ? prev + '\n\n' + formatted : formatted))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (!poemContent.trim()) return
    savePoem(poemTitle || 'untitled', poemContent, [...selectedIds])
    setPoemTitle('')
  }

  const hasApiKey = !!getSettings().apiKey

  return (
    <div className="h-full overflow-y-auto px-4 py-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-ink-dim hover:text-ink transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-xl italic font-semibold text-ink" style={{ fontFamily: '"Cormorant Garamond", serif' }}>
          forge a poem
        </h1>
      </div>

      {inspirations.length === 0 ? (
        <div className="text-center py-16 text-ink-dim/30 italic">
          <p>nothing gathered yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Fragment toggles */}
          <div>
            <p className="text-xs text-ink-dim/40 mb-2 italic">
              fragments · click to toggle · {selectedIds.size} selected
            </p>
            <div className="flex flex-wrap gap-1.5">
              {inspirations.map((insp) => {
                const isSelected = selectedIds.has(insp.id)
                return (
                  <button
                    key={insp.id}
                    onClick={() => toggleSelect(insp.id)}
                    className={`px-3 py-1 text-sm transition-colors cursor-pointer ${
                      isSelected
                        ? 'text-amber border border-amber/40 bg-amber/5'
                        : 'text-ink-dim/30 border border-transparent bg-white/[0.02] line-through'
                    }`}
                  >
                    {insp.content.slice(0, 18)}
                    {insp.content.length > 18 ? '…' : ''}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Poem canvas */}
          <div className="workshop-sheet p-5">
            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                value={poemTitle}
                onChange={(e) => setPoemTitle(e.target.value)}
                placeholder="untitled"
                className="flex-1"
              />
              {hasApiKey && (
                <button
                  onClick={handleAssemble}
                  disabled={selectedIds.size === 0 || loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber border border-amber/30 hover:bg-amber/10 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  structure
                </button>
              )}
            </div>
            <textarea
              value={poemContent}
              onChange={(e) => setPoemContent(e.target.value)}
              placeholder="the poem will take shape here..."
              rows={14}
            />
            {error && (
              <p className="text-sm text-redink mt-2 bg-redink/10 px-3 py-2">{error}</p>
            )}
            <div className="flex justify-end mt-3 pt-3 border-t border-white/5">
              <button
                onClick={handleSave}
                disabled={!poemContent.trim()}
                className="px-5 py-1.5 text-sm text-amber border border-amber/40 hover:bg-amber/10 transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-default"
              >
                save draft
              </button>
            </div>
          </div>

          {/* Saved poems */}
          {poems.length > 0 && (
            <div>
              <p className="text-xs text-ink-dim/40 mb-3 italic">saved drafts · {poems.length}</p>
              <div className="space-y-2">
                {poems.map((poem) => (
                  <div key={poem.id} className="workshop-sheet p-3">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setExpandedPoem(expandedPoem === poem.id ? null : poem.id)}
                        className="flex items-center gap-2 text-left flex-1 min-w-0 cursor-pointer"
                      >
                        <span className="font-medium text-ink truncate italic">
                          {poem.title || 'untitled'}
                        </span>
                        <span className="text-xs text-ink-dim/40">
                          {new Date(poem.updatedAt).toLocaleDateString('zh-CN')}
                        </span>
                        {expandedPoem === poem.id ? (
                          <ChevronUp size={12} className="text-ink-dim shrink-0" />
                        ) : (
                          <ChevronDown size={12} className="text-ink-dim shrink-0" />
                        )}
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => navigator.clipboard.writeText(poem.content)}
                          className="p-1 text-ink-dim/40 hover:text-ink-dim transition-colors cursor-pointer"
                          title="copy"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          onClick={() => removePoem(poem.id)}
                          className="p-1 text-ink-dim/30 hover:text-redink transition-colors cursor-pointer"
                          title="delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {expandedPoem === poem.id && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <p className="text-sm text-ink-dim poem-text whitespace-pre-wrap">
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
      )}
    </div>
  )
}
