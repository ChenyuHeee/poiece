import { useState, useRef, useCallback, useMemo } from 'react'
import { useStore } from '../store'
import { agents as agentDefs } from '../agents/defs'
import { callLLM, getSettings, parseAgentItems } from '../lib/llm'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Trash2 } from 'lucide-react'

const floatAnims = ['a', 'b', 'c', 'd', 'e', 'f']

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function lcg(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) | 0
    return (state >>> 0) / 4294967296
  }
}

function computeCloudLayout(keys: string[], sessionSeed: number) {
  const n = Math.max(keys.length, 1)
  const cols = Math.ceil(Math.sqrt(n * 1.8))
  const rows = Math.ceil(n / cols)
  const cellW = 88 / cols
  const cellH = 80 / rows
  const result = new Map<string, { x: number; y: number; rot: number; scale: number; anim: number; delay: number }>()

  keys.forEach((key, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const rng = lcg(hashString(key) ^ sessionSeed)
    const bx = 6 + col * cellW + cellW * 0.5 + (rng() - 0.5) * cellW * 0.8
    const by = 4 + row * cellH + cellH * 0.5 + (rng() - 0.5) * cellH * 0.8
    result.set(key, {
      x: Math.max(1, Math.min(95, bx)),
      y: Math.max(1, Math.min(92, by)),
      rot: -10 + rng() * 20,
      scale: 0.75 + rng() * 0.45,
      anim: Math.floor(rng() * 6),
      delay: rng() * 3,
    })
  })

  return result
}

export default function Home() {
  const inspirations = useStore((s) => s.inspirations)
  const addInspiration = useStore((s) => s.addInspiration)
  const removeInspiration = useStore((s) => s.removeInspiration)
  const promoteAgentResponse = useStore((s) => s.promoteAgentResponse)
  const removeAgentResponse = useStore((s) => s.removeAgentResponse)

  const [input, setInput] = useState('')
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [dragOverZone, setDragOverZone] = useState(false)
  const sessionSeed = useRef(Date.now())
  const navigate = useNavigate()
  const hasApiKey = !!getSettings().apiKey

  // Gather all cloud bubble keys for layout
  const cloudKeys = useMemo(() => {
    const keys: string[] = []
    inspirations.forEach((insp) => {
      insp.responses.forEach((_, ri) => keys.push(`${insp.id}:${ri}`))
    })
    return keys
  }, [inspirations])

  const cloudLayout = useMemo(
    () => computeCloudLayout(cloudKeys, sessionSeed.current),
    [cloudKeys]
  )

  const totalCloudBubbles = cloudKeys.length

  const handleAdd = useCallback(async () => {
    const v = input.trim()
    if (!v) return
    addInspiration(v, [])
    setInput('')

    if (!hasApiKey) return

    // zustand is synchronous — read immediately
    const latest = useStore.getState().inspirations[0]
    if (!latest || latest.content !== v) return

    setLoadingIds((prev) => new Set(prev).add(latest.id))

    const context = useStore.getState().inspirations
      .filter((i) => i.id !== latest.id)
      .slice(0, 5)
      .map((i) => i.content)
      .join(' / ')

    const results = await Promise.allSettled(
      agentDefs.map(async (agent) => {
        const raw = await callLLM(agent.systemPrompt, agent.userPromptTemplate(v, context))
        return { agentId: agent.id, items: parseAgentItems(raw) }
      })
    )

    const allItems: { agentId: string; title: string; content: string }[] = []
    results.forEach((r) => {
      if (r.status === 'fulfilled') {
        r.value.items.forEach((it) => allItems.push({ agentId: r.value.agentId, title: it.title, content: it.body }))
      }
    })

    if (allItems.length > 0) {
      useStore.getState().addAgentResponses(latest.id, allItems)
    }
    setLoadingIds((prev) => {
      const next = new Set(prev)
      next.delete(latest.id)
      return next
    })
  }, [input, addInspiration, hasApiKey])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  // Click to collect (in addition to drag)
  const collectBubble = (inspirationId: string, responseIndex: number) => {
    promoteAgentResponse(inspirationId, responseIndex)
  }

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, inspirationId: string, responseIndex: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ inspirationId, responseIndex }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverZone(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Only set false if leaving the zone entirely
    const rect = e.currentTarget.getBoundingClientRect()
    const { clientX, clientY } = e
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOverZone(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverZone(false)
    try {
      const { inspirationId, responseIndex } = JSON.parse(e.dataTransfer.getData('text/plain'))
      promoteAgentResponse(inspirationId, responseIndex)
    } catch {}
  }

  const handleGoWorkshop = () => {
    if (inspirations.length > 0) {
      navigate('/workshop', { state: { preSelected: inspirations.map((i) => i.id) } })
    }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100svh - 56px)' }}>
      {/* Split zone */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left: AI Cloud */}
        <div className="flex-1 relative border-r border-ink-200/50 min-h-[45%] lg:min-h-0">
          <div className="absolute top-2 left-3 text-xs text-ink-300 z-10 pointer-events-none">
            AI 气泡云 {totalCloudBubbles > 0 && `(${totalCloudBubbles})`}
          </div>

          {totalCloudBubbles === 0 && loadingIds.size === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-ink-200 select-none pointer-events-none">
              <div className="text-center">
                <p className="text-5xl mb-2">🫧</p>
                <p className="text-xs">输入词句，AI 气泡浮现</p>
              </div>
            </div>
          )}

          {totalCloudBubbles === 0 && loadingIds.size > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-ink-300 animate-[shimmer_1s_ease-in-out_infinite]">
                AI 正在思考...
              </p>
            </div>
          )}

          <div className="relative w-full h-full overflow-hidden">
            {inspirations.map((insp) =>
              insp.responses.map((resp, ri) => {
                const key = `${insp.id}:${ri}`
                const layout = cloudLayout.get(key)
                if (!layout) return null
                const agent = agentDefs.find((a) => a.id === resp.agentId)
                const animName = floatAnims[layout.anim]
                const isLoading = loadingIds.has(insp.id)

                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, insp.id, ri)}
                    onClick={() => collectBubble(insp.id, ri)}
                    style={{
                      position: 'absolute',
                      left: `${layout.x}%`,
                      top: `${layout.y}%`,
                      transform: `rotate(${layout.rot}deg) scale(${layout.scale})`,
                      animationDelay: `${layout.delay}s`,
                      maxWidth: 200,
                      zIndex: 1,
                    }}
                    className={`bubble bubble-agent bubble-agent-${resp.agentId} bubble-float-${animName} group cursor-grab active:cursor-grabbing hover:z-20 ${isLoading ? 'opacity-60' : ''}`}
                    title={`${agent?.icon} ${agent?.name}\n${resp.content}\n点击或拖拽到右侧收藏`}
                  >
                    <span className="mr-1 text-xs shrink-0">{agent?.icon}</span>
                    <span className="truncate">{resp.title || resp.content.slice(0, 20)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        removeAgentResponse(insp.id, ri)
                      }}
                      className="ml-1 w-4 h-4 rounded-full bg-ink-200/50 text-ink-500 hover:bg-red-200 hover:text-red-500 flex items-center justify-center text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-30"
                      title="移除此气泡"
                    >
                      ×
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right: My Zone */}
        <div
          className={`flex-1 flex flex-col min-h-[35%] lg:min-h-0 relative transition-colors ${
            dragOverZone ? 'bg-accent/10' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-ink-200/50 shrink-0">
            <span className="text-xs text-ink-300">
              我的碎片 {inspirations.length > 0 && `(${inspirations.length})`}
            </span>
            {inspirations.length > 0 && (
              <button
                onClick={handleGoWorkshop}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors cursor-pointer"
              >
                成诗 <ArrowRight size={10} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {inspirations.length === 0 ? (
              <div className="flex items-center justify-center h-full text-ink-200 select-none pointer-events-none">
                <p className="text-xs">输入词句或拖拽/点击 AI 气泡来这里</p>
              </div>
            ) : (
              inspirations.map((insp) => (
                <div
                  key={insp.id}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-white/40 transition-colors group"
                >
                  <p className="flex-1 text-sm text-ink-800 poem-text leading-relaxed break-words min-w-0">
                    {insp.content}
                  </p>
                  <button
                    onClick={() => removeInspiration(insp.id)}
                    className="p-0.5 text-ink-300 hover:text-red-400 transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Drop overlay hint */}
          {dragOverZone && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-accent/5">
              <p className="text-accent text-lg font-medium">释放以收藏</p>
            </div>
          )}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2 shadow-lg">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-ink-200/50 bg-parchment/90 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="捕捉一缕思绪，回车即记录..."
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-base text-ink-900 placeholder-ink-300 font-[inherit]"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="shrink-0 w-9 h-9 rounded-full bg-accent text-white text-lg flex items-center justify-center disabled:opacity-30 transition-opacity cursor-pointer disabled:cursor-default hover:bg-accent/90"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}
