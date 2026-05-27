import { useState, useRef, useCallback, useMemo } from 'react'
import { useStore } from '../store'
import { agents as agentDefs } from '../agents/defs'
import { callLLM, getSettings, parseAgentItems } from '../lib/llm'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, GripVertical, Trash2 } from 'lucide-react'

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

function computeCloudLayout(
  allResponses: { key: string; agentId: string }[],
  sessionSeed: number
) {
  const n = Math.max(allResponses.length, 1)
  const cols = Math.ceil(Math.sqrt(n * 1.8))
  const rows = Math.ceil(n / cols)
  const cellW = 88 / cols
  const cellH = 80 / rows
  const result = new Map<string, { x: number; y: number; rot: number; scale: number; anim: number; delay: number }>()

  allResponses.forEach((r, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const rng = lcg(hashString(r.key) ^ sessionSeed)
    const bx = 6 + col * cellW + cellW * 0.5 + (rng() - 0.5) * cellW * 0.8
    const by = 4 + row * cellH + cellH * 0.5 + (rng() - 0.5) * cellH * 0.8
    result.set(r.key, {
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
  const [loadingFor, setLoadingFor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [dragOverZone, setDragOverZone] = useState(false)
  const sessionSeed = useRef(Date.now())
  const navigate = useNavigate()
  const hasApiKey = !!getSettings().apiKey

  // Gather all agent responses across all inspirations
  const allCloudItems = useMemo(() => {
    const items: { key: string; agentId: string }[] = []
    inspirations.forEach((insp) => {
      insp.responses.forEach((resp, ri) => {
        items.push({ key: `${insp.id}:${ri}`, agentId: resp.agentId })
      })
    })
    return items
  }, [inspirations])

  const cloudLayout = useMemo(
    () => computeCloudLayout(allCloudItems, sessionSeed.current),
    [allCloudItems]
  )

  const handleAdd = useCallback(async () => {
    const v = input.trim()
    if (!v) return
    addInspiration(v, [])
    setInput('')

    if (!hasApiKey) return

    // Get the newly added inspiration (first in list after add)
    const settings = getSettings()
    if (!settings.apiKey) return

    // We need the new fragment's ID — it's at the top of the list
    // Small delay to let zustand update
    setTimeout(async () => {
      const state = useStore.getState()
      const latest = state.inspirations[0]
      if (!latest || latest.content !== v) return

      setLoadingFor(latest.id)
      const context = state.inspirations
        .filter((i) => i.id !== latest.id)
        .slice(0, 5)
        .map((i) => i.content)
        .join(' / ')

      // Call all agents in parallel
      const results = await Promise.allSettled(
        agentDefs.map(async (agent) => {
          const raw = await callLLM(
            agent.systemPrompt,
            agent.userPromptTemplate(v, context),
            undefined
          )
          const items = parseAgentItems(raw)
          return { agentId: agent.id, items }
        })
      )

      const allItems: { agentId: string; title: string; content: string }[] = []
      results.forEach((r) => {
        if (r.status === 'fulfilled') {
          r.value.items.forEach((it) => {
            allItems.push({ agentId: r.value.agentId, title: it.title, content: it.body })
          })
        }
      })

      if (allItems.length > 0) {
        useStore.getState().addAgentResponses(latest.id, allItems)
      }
      setLoadingFor(null)
    }, 50)
  }, [input, addInspiration, hasApiKey])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  const handleDragStart = (e: React.DragEvent, inspirationId: string, responseIndex: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ inspirationId, responseIndex }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverZone(true)
  }

  const handleDragLeave = () => setDragOverZone(false)

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
            AI 气泡云
          </div>

          {allCloudItems.length === 0 && !loadingFor && (
            <div className="absolute inset-0 flex items-center justify-center text-ink-200 select-none pointer-events-none">
              <div className="text-center">
                <p className="text-5xl mb-2">🫧</p>
                <p className="text-xs">输入一个词，AI 气泡会浮现</p>
              </div>
            </div>
          )}

          {loadingFor && allCloudItems.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-ink-300 animate-[shimmer_1s_ease-in-out_infinite]">
                AI 正在思考...
              </p>
            </div>
          )}

          {/* Cloud bubbles */}
          <div className="relative w-full h-full overflow-hidden">
            {inspirations.map((insp) =>
              insp.responses.map((resp, ri) => {
                const key = `${insp.id}:${ri}`
                const layout = cloudLayout.get(key)
                if (!layout) return null
                const agent = agentDefs.find((a) => a.id === resp.agentId)
                const animName = floatAnims[layout.anim]

                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, insp.id, ri)}
                    style={{
                      position: 'absolute',
                      left: `${layout.x}%`,
                      top: `${layout.y}%`,
                      transform: `rotate(${layout.rot}deg) scale(${layout.scale})`,
                      animationDelay: `${layout.delay}s`,
                      maxWidth: 200,
                      zIndex: 1,
                      cursor: 'grab',
                    }}
                    className={`bubble bubble-agent bubble-agent-${resp.agentId} bubble-float-${animName} group`}
                    title={`${agent?.icon} ${agent?.name}: ${resp.content}\n拖拽到右侧收藏`}
                  >
                    <span className="mr-1 text-xs shrink-0">{agent?.icon}</span>
                    <span className="truncate">{resp.title || resp.content.slice(0, 20)}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        removeAgentResponse(insp.id, ri)
                      }}
                      className="ml-1 w-4 h-4 rounded-full bg-ink-200/50 text-ink-500 hover:bg-red-200 hover:text-red-500 flex items-center justify-center text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="移除这个气泡"
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
          className={`flex-1 flex flex-col min-h-[35%] lg:min-h-0 transition-colors ${
            dragOverZone ? 'bg-accent/10' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-ink-200/50 shrink-0">
            <span className="text-xs text-ink-300">我的碎片</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-300">{inspirations.length}</span>
              {inspirations.length > 0 && (
                <button
                  onClick={handleGoWorkshop}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors cursor-pointer"
                >
                  成诗
                  <ArrowRight size={10} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {inspirations.length === 0 ? (
              <div className="flex items-center justify-center h-full text-ink-200 select-none">
                <p className="text-xs">输入词句或拖拽 AI 气泡到这里</p>
              </div>
            ) : (
              inspirations.map((insp) => (
                <div
                  key={insp.id}
                  className="group flex items-start gap-2 px-3 py-2 rounded-lg hover:bg-white/40 transition-colors"
                >
                  <GripVertical size={12} className="text-ink-300 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <p className="flex-1 text-sm text-ink-800 poem-text leading-relaxed break-words min-w-0">
                    {insp.content}
                  </p>
                  <button
                    onClick={() => removeInspiration(insp.id)}
                    className="p-0.5 text-ink-300 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Drop hint */}
          {dragOverZone && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
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
