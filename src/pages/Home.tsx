import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useStore } from '../store'
import { agents as agentDefs } from '../agents/defs'
import { callLLM, getSettings, parseAgentItems } from '../lib/llm'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'

const floatAnims = ['a', 'b', 'c', 'd', 'e', 'f']
const tornVariants = ['torn-paper', 'torn-paper-v2', 'torn-paper-v3']

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function lcg(seed: number): () => number {
  let state = seed
  return () => { state = (state * 1664525 + 1013904223) | 0; return (state >>> 0) / 4294967296 }
}

// Layout all items (fragments + AI bubbles) in one chaotic grid
interface PlacedItem {
  x: number; y: number; rot: number; scale: number
  anim: number; delay: number
}

function computeUnifiedLayout(
  fragments: { key: string; textLen: number }[],
  bubbles: { key: string }[],
  sessionSeed: number
): Map<string, PlacedItem> {
  const all = [
    ...fragments.map((f) => ({ key: f.key, size: Math.min(f.textLen * 13 + 36, 280) })),
    ...bubbles.map((b) => ({ key: b.key, size: 140 })),
  ]
  const n = Math.max(all.length, 1)
  const cols = Math.ceil(Math.sqrt(n * 1.8))
  const rows = Math.ceil(n / cols)
  const cellW = 90 / cols
  const cellH = 84 / rows
  const result = new Map<string, PlacedItem>()

  all.forEach((item, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const rng = lcg(hashString(item.key) ^ sessionSeed)
    result.set(item.key, {
      x: Math.max(2, Math.min(94, 5 + col * cellW + cellW * 0.5 + (rng() - 0.5) * cellW * 0.85)),
      y: Math.max(2, Math.min(90, 3 + row * cellH + cellH * 0.5 + (rng() - 0.5) * cellH * 0.85)),
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
  const cleanupExpiredResponses = useStore((s) => s.cleanupExpiredResponses)

  const [input, setInput] = useState('')
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [selectedForForge, setSelectedForForge] = useState<Set<string>>(new Set())
  const sessionSeed = useRef(Date.now())
  const navigate = useNavigate()
  const hasApiKey = !!getSettings().apiKey

  useEffect(() => {
    const interval = setInterval(() => cleanupExpiredResponses(3 * 60 * 1000, 20), 30000)
    return () => clearInterval(interval)
  }, [cleanupExpiredResponses])

  // Build unified layout keys
  const layoutInput = useMemo(() => {
    const fragments: { key: string; textLen: number }[] = []
    const bubbles: { key: string }[] = []
    inspirations.forEach((insp) => {
      fragments.push({ key: `frag:${insp.id}`, textLen: insp.content.length })
      insp.responses.forEach((_, ri) => bubbles.push({ key: `bubble:${insp.id}:${ri}` }))
    })
    return { fragments, bubbles }
  }, [inspirations])

  const layout = useMemo(
    () => computeUnifiedLayout(layoutInput.fragments, layoutInput.bubbles, sessionSeed.current),
    [layoutInput]
  )

  const handleAdd = useCallback(async () => {
    const v = input.trim()
    if (!v) return
    addInspiration(v, [])
    setInput('')
    if (!hasApiKey) return

    const latest = useStore.getState().inspirations[0]
    if (!latest || latest.content !== v) return
    setLoadingIds((prev) => new Set(prev).add(latest.id))

    const ctx = useStore.getState().inspirations
      .filter((i) => i.id !== latest.id).slice(0, 5).map((i) => i.content).join(' / ')

    const results = await Promise.allSettled(
      agentDefs.map(async (agent) => {
        const raw = await callLLM(agent.systemPrompt, agent.userPromptTemplate(v, ctx))
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

  const collectBubble = (inspId: string, respIdx: number) => {
    promoteAgentResponse(inspId, respIdx)
    removeAgentResponse(inspId, respIdx)
  }

  const toggleForgeSelect = (fragId: string) => {
    setSelectedForForge((prev) => {
      const next = new Set(prev)
      if (next.has(fragId)) next.delete(fragId)
      else next.add(fragId)
      return next
    })
  }

  const forgeCount = selectedForForge.size
  const totalItems = inspirations.length + inspirations.reduce((s, i) => s + i.responses.length, 0)

  return (
    <div className="h-full flex flex-col">
      {/* Canvas — everything floats here */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {totalItems === 0 && loadingIds.size === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-ink-dim/25 italic text-base">speak a word</p>
          </div>
        )}
        {totalItems === 0 && loadingIds.size > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-amber/50 animate-[shimmer_1.5s_ease-in-out_infinite] italic">ink spreading...</p>
          </div>
        )}

        {/* Floating forge button */}
        {inspirations.length > 0 && (
          <button
            onClick={() => {
              const ids = forgeCount > 0 ? [...selectedForForge] : inspirations.map((i) => i.id)
              navigate('/workshop', { state: { preSelected: ids } })
            }}
            className="absolute top-3 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber border border-amber/30 bg-desk/80 backdrop-blur hover:bg-amber/10 transition-colors cursor-pointer italic"
          >
            <Sparkles size={11} />
            forge{forgeCount > 0 ? ` (${forgeCount})` : ` (${inspirations.length})`}
          </button>
        )}

        {/* Hint text */}
        {forgeCount > 0 && (
          <div className="absolute top-3 left-4 z-20 text-xs text-ink-dim/30 italic">
            {forgeCount} selected
          </div>
        )}

        {/* All items floating in one space */}
        {inspirations.map((insp) => {
          // --- User fragment (torn paper) ---
          const fragKey = `frag:${insp.id}`
          const fragLayout = layout.get(fragKey)
          const isSelected = selectedForForge.has(insp.id)
          const seed = hashString(insp.id)
          const variant = tornVariants[seed % 3]
          const fragRot = -3 + (seed % 60) / 10

          return (
            <div key={insp.id}>
              {/* Fragment as torn paper */}
              {fragLayout && (
                <div
                  style={{
                    position: 'absolute',
                    left: `${fragLayout.x}%`,
                    top: `${fragLayout.y}%`,
                    zIndex: isSelected ? 15 : 5,
                  }}
                >
                  <div style={{ transform: `rotate(${fragRot}deg) scale(${fragLayout.scale})` }}>
                    <button
                      onClick={() => toggleForgeSelect(insp.id)}
                      className={`${variant} group flex items-center gap-1.5 px-3 py-2 max-w-[260px] cursor-pointer transition-shadow ${
                        isSelected ? '!shadow-[0_0_0_2px_var(--color-amber),0_0_16px_rgba(200,121,65,0.35)]' : ''
                      }`}
                    >
                      <span className="text-sm poem-text break-words min-w-0 line-clamp-3">{insp.content}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeInspiration(insp.id) }}
                        className="shrink-0 w-3.5 h-3.5 rounded-full bg-desk/30 text-ink-dim/40 hover:bg-redink/40 hover:text-redink text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >×</button>
                    </button>
                  </div>
                </div>
              )}

              {/* AI bubbles for this fragment */}
              {insp.responses.map((resp, ri) => {
                const bubbleKey = `bubble:${insp.id}:${ri}`
                const bubbleLayout = layout.get(bubbleKey)
                if (!bubbleLayout) return null
                const agent = agentDefs.find((a) => a.id === resp.agentId)
                const animName = floatAnims[bubbleLayout.anim]
                const age = Date.now() - resp.timestamp
                const fading = age > 2.5 * 60 * 1000

                return (
                  <div
                    key={bubbleKey}
                    style={{
                      position: 'absolute',
                      left: `${bubbleLayout.x}%`,
                      top: `${bubbleLayout.y}%`,
                      zIndex: 2,
                    }}
                  >
                    <div
                      style={{
                        transform: `rotate(${bubbleLayout.rot}deg) scale(${bubbleLayout.scale})`,
                        animationDelay: `${bubbleLayout.delay}s`,
                        opacity: fading ? 0.35 : 1,
                        transition: 'opacity 2s ease',
                      }}
                    >
                      <button
                        onClick={() => collectBubble(insp.id, ri)}
                        className={`ink-bubble ink-bubble-${resp.agentId} ink-float-${animName} group cursor-pointer`}
                        style={{ maxWidth: 200 }}
                        title={`${agent?.icon} ${agent?.name}\n${resp.content}\nclick to keep`}
                      >
                        <span className="mr-1 text-xs shrink-0">{agent?.icon}</span>
                        <span className="truncate">{resp.content}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); removeAgentResponse(insp.id, ri) }}
                          className="ml-1 w-4 h-4 rounded-full bg-amber/10 text-ink-dim/50 hover:bg-redink/30 hover:text-redink-glow flex items-center justify-center text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >×</button>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* Input bar — the only fixed element */}
      <div className="scribe-input shrink-0">
        <div className="flex items-center gap-3 px-4 py-3 max-w-xl mx-auto">
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
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-redink/20 border border-redink/30 text-red-200 text-sm px-4 py-2 shadow-lg">
          {error}
          <button onClick={() => setError('')} className="ml-3 text-redink-glow">×</button>
        </div>
      )}
    </div>
  )
}
