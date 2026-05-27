import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useStore } from '../store'
import { agents as agentDefs } from '../agents/defs'
import { callLLM, getSettings, parseAgentItems } from '../lib/llm'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Trash2 } from 'lucide-react'

const floatAnims = ['a', 'b', 'c', 'd', 'e', 'f']
const tornVariants = ['torn-paper', 'torn-paper-v2', 'torn-paper-v3']

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
  const map = new Map<string, { x: number; y: number; rot: number; scale: number; anim: number; delay: number }>()

  keys.forEach((key, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const rng = lcg(hashString(key) ^ sessionSeed)
    map.set(key, {
      x: Math.max(1, Math.min(94, 6 + col * cellW + cellW * 0.5 + (rng() - 0.5) * cellW * 0.8)),
      y: Math.max(1, Math.min(92, 4 + row * cellH + cellH * 0.5 + (rng() - 0.5) * cellH * 0.8)),
      rot: -12 + rng() * 24,
      scale: 0.72 + rng() * 0.5,
      anim: Math.floor(rng() * 6),
      delay: rng() * 3,
    })
  })
  return map
}

export default function Home() {
  const inspirations = useStore((s) => s.inspirations)
  const addInspiration = useStore((s) => s.addInspiration)
  const removeInspiration = useStore((s) => s.removeInspiration)
  const promoteAgentResponse = useStore((s) => s.promoteAgentResponse)
  const removeAgentResponse = useStore((s) => s.removeAgentResponse)
  const cleanupExpiredResponses = useStore((s) => s.cleanupExpiredResponses)

  const [input, setInput] = useState('')
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [dragOverZone, setDragOverZone] = useState(false)
  const sessionSeed = useRef(Date.now())
  const navigate = useNavigate()
  const hasApiKey = !!getSettings().apiKey

  const cloudKeys = useMemo(() => {
    const keys: string[] = []
    inspirations.forEach((insp) => insp.responses.forEach((_, ri) => keys.push(`${insp.id}:${ri}`)))
    return keys
  }, [inspirations])

  const cloudLayout = useMemo(() => computeCloudLayout(cloudKeys, sessionSeed.current), [cloudKeys])

  // Auto-evict old bubbles: 3min lifespan, max 20 bubbles
  useEffect(() => {
    const interval = setInterval(() => cleanupExpiredResponses(3 * 60 * 1000, 20), 30000)
    return () => clearInterval(interval)
  }, [cleanupExpiredResponses])

  const handleAdd = useCallback(async () => {
    const v = input.trim()
    if (!v) return
    addInspiration(v, [])
    setInput('')
    if (!hasApiKey) return

    const latest = useStore.getState().inspirations[0]
    if (!latest || latest.content !== v) return
    setLoadingIds((prev) => new Set(prev).add(latest.id))

    const context = useStore.getState().inspirations
      .filter((i) => i.id !== latest.id).slice(0, 5).map((i) => i.content).join(' / ')

    const results = await Promise.allSettled(
      agentDefs.map(async (agent) => {
        const raw = await callLLM(agent.systemPrompt, agent.userPromptTemplate(v, context))
        return { agentId: agent.id, items: parseAgentItems(raw) }
      })
    )
    const allItems: { agentId: string; title: string; content: string }[] = []
    results.forEach((r) => {
      if (r.status === 'fulfilled') r.value.items.forEach((it) => allItems.push({ agentId: r.value.agentId, title: it.title, content: it.body }))
    })
    if (allItems.length > 0) useStore.getState().addAgentResponses(latest.id, allItems)
    setLoadingIds((prev) => { const n = new Set(prev); n.delete(latest.id); return n })
  }, [input, addInspiration, hasApiKey])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  const collectBubble = (inspirationId: string, responseIndex: number) => {
    promoteAgentResponse(inspirationId, responseIndex)
    removeAgentResponse(inspirationId, responseIndex)
  }

  const handleDragStart = (e: React.DragEvent, inspirationId: string, responseIndex: number) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ inspirationId, responseIndex }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOverZone(true) }
  const handleDragLeave = (e: React.DragEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setDragOverZone(false)
  }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOverZone(false)
    try { const d = JSON.parse(e.dataTransfer.getData('text/plain')); promoteAgentResponse(d.inspirationId, d.responseIndex) } catch {}
  }

  const totalCloudBubbles = cloudKeys.length

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Left — AI Ink Cloud */}
        <div className="flex-1 relative min-h-[45%] lg:min-h-0">
          <div className="absolute top-2.5 left-4 text-xs text-ink-dim/50 z-10 pointer-events-none italic">
            ink cloud {totalCloudBubbles > 0 && `· ${totalCloudBubbles}`}
          </div>

          {totalCloudBubbles === 0 && loadingIds.size === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-ink-dim/30 italic text-sm">speak a word, ink will answer</p>
            </div>
          )}
          {totalCloudBubbles === 0 && loadingIds.size > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-amber/50 animate-[shimmer_1.5s_ease-in-out_infinite] italic">ink spreading...</p>
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
                const age = Date.now() - resp.timestamp
                const fading = age > 2.5 * 60 * 1000 // fade in last 30s of 3min life

                return (
                  <div
                    key={key}
                    draggable
                    onDragStart={(e) => handleDragStart(e, insp.id, ri)}
                    onClick={() => collectBubble(insp.id, ri)}
                    style={{
                      position: 'absolute',
                      left: `${layout.x}%`, top: `${layout.y}%`,
                      transform: `rotate(${layout.rot}deg) scale(${layout.scale})`,
                      animationDelay: `${layout.delay}s`,
                      maxWidth: 200, zIndex: 1,
                      opacity: fading ? 0.35 : 1,
                      transition: 'opacity 2s ease',
                    }}
                    className={`ink-bubble ink-bubble-${resp.agentId} ink-float-${animName} group`}
                    title={`${agent?.icon} ${agent?.name}\n${resp.content}\nclick or drag → collect`}
                  >
                    <span className="mr-1 text-xs shrink-0">{agent?.icon}</span>
                    <span className="truncate">{resp.content}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); removeAgentResponse(insp.id, ri) }}
                      className="ml-1 w-4 h-4 rounded-full bg-amber/10 text-ink-dim/50 hover:bg-redink/30 hover:text-redink-glow flex items-center justify-center text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >×</button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="desk-divider hidden lg:block" />

        {/* Right — Collected fragments */}
        <div
          className={`flex-1 flex flex-col min-h-[35%] lg:min-h-0 relative ${dragOverZone ? 'drop-glow' : ''}`}
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        >
          <div className="flex items-center justify-between px-4 py-2.5 shrink-0">
            <span className="text-xs text-ink-dim/50 italic">
              gathered {inspirations.length > 0 && `· ${inspirations.length}`}
            </span>
            {inspirations.length > 0 && (
              <button
                onClick={() => navigate('/workshop', { state: { preSelected: inspirations.map((i) => i.id) } })}
                className="flex items-center gap-1 px-3 py-1 text-xs text-amber border border-amber/30 hover:bg-amber/10 transition-colors cursor-pointer italic"
              >
                forge <ArrowRight size={11} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2.5">
            {inspirations.length === 0 ? (
              <div className="flex items-center justify-center h-full pointer-events-none">
                <p className="text-ink-dim/25 italic text-sm">scatter thoughts here</p>
              </div>
            ) : (
              inspirations.map((insp) => {
                const seed = hashString(insp.id)
                const variant = tornVariants[seed % 3]
                const rot = -2 + (seed % 50) / 10
                return (
                  <div
                    key={insp.id}
                    className={`${variant} group flex items-start gap-2 px-3.5 py-2.5`}
                    style={{ transform: `rotate(${rot}deg)` }}
                  >
                    <p className="flex-1 text-sm poem-text leading-relaxed break-words min-w-0">
                      {insp.content}
                    </p>
                    <button
                      onClick={() => removeInspiration(insp.id)}
                      className="p-0.5 text-ink-dim/30 hover:text-redink transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
                      title="discard"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          {dragOverZone && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <p className="text-amber/80 text-lg italic">release to keep</p>
            </div>
          )}
        </div>
      </div>

      {/* Input bar */}
      <div className="scribe-input shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 max-w-2xl mx-auto">
          <input
            type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="a stray thought..."
            autoFocus
          />
          <button onClick={handleAdd} disabled={!input.trim()} className="scribe-btn">+</button>
        </div>
      </div>

      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-redink/20 border border-redink/30 text-red-200 text-sm px-4 py-2 shadow-lg">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-redink-glow hover:text-red-200">×</button>
        </div>
      )}
    </div>
  )
}
