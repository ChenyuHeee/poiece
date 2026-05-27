import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { agents } from '../agents/defs'
import { callLLM, getSettings } from '../lib/llm'
import { X, Loader2, Sparkles, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const floatClasses = ['bubble-float-a', 'bubble-float-b', 'bubble-float-c', 'bubble-float-d']

function seedFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0
  return Math.abs(h)
}

export default function Home() {
  const inspirations = useStore((s) => s.inspirations)
  const addInspiration = useStore((s) => s.addInspiration)
  const removeInspiration = useStore((s) => s.removeInspiration)
  const addAgentResponse = useStore((s) => s.addAgentResponse)
  const promoteAgentResponse = useStore((s) => s.promoteAgentResponse)
  const clearAgentResponses = useStore((s) => s.clearAgentResponses)

  const [input, setInput] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loadingAgent, setLoadingAgent] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const navigate = useNavigate()

  const hasApiKey = !!getSettings().apiKey

  const handleAdd = useCallback(() => {
    const v = input.trim()
    if (!v) return
    addInspiration(v, [])
    setInput('')
  }, [input, addInspiration])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  const handleCallAgent = async (inspirationId: string, agentId: string) => {
    const insp = inspirations.find((i) => i.id === inspirationId)
    if (!insp) return
    const agent = agents.find((a) => a.id === agentId)
    if (!agent) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const context = inspirations
      .filter((i) => i.id !== inspirationId)
      .slice(0, 5)
      .map((i) => i.content)
      .join(' / ')

    setLoadingAgent(`${inspirationId}:${agentId}`)
    setError('')
    try {
      const result = await callLLM(
        agent.systemPrompt,
        agent.userPromptTemplate(insp.content, context),
        controller.signal
      )
      addAgentResponse(inspirationId, { agentId, content: result })
    } catch (e: any) {
      if (e.name === 'AbortError') return
      setError(e.message)
    } finally {
      setLoadingAgent(null)
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const expanded = inspirations.find((i) => i.id === expandedId)

  return (
    <div className="relative min-h-[calc(100svh-56px)]">
      {/* Canvas area */}
      <div className="bubble-canvas">
        {inspirations.length === 0 ? (
          <div className="text-center text-ink-300 select-none">
            <p className="text-6xl mb-6 animate-[floatA_4s_ease-in-out_infinite]">🫧</p>
            <p className="text-lg">写下第一个碎片</p>
            <p className="text-sm mt-1">它会像气泡一样浮现在这里</p>
          </div>
        ) : (
          inspirations.map((insp) => {
            const seed = seedFromId(insp.id)
            const floatClass = floatClasses[seed % floatClasses.length]
            const size = Math.min(insp.content.length * 14 + 40, 320)
            const isSelected = selectedIds.has(insp.id)

            return (
              <div key={insp.id} className="relative group">
                {/* Main fragment bubble */}
                <button
                  onClick={() => {
                    if (selectionMode) {
                      toggleSelect(insp.id)
                    } else {
                      setExpandedId(insp.id)
                    }
                  }}
                  style={{ minWidth: size > 180 ? 180 : size, maxWidth: 320 }}
                  className={`bubble bubble-mine ${floatClass} ${isSelected ? 'bubble-selected' : ''}`}
                  title={insp.content}
                >
                  <span className="truncate">{insp.content}</span>

                  {/* Agent response count badge */}
                  {insp.responses.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-accent text-white text-[10px] flex items-center justify-center font-medium">
                      {insp.responses.length}
                    </span>
                  )}
                </button>

                {/* Agent bubbles orbiting around */}
                {insp.responses.map((resp, ri) => {
                  const agent = agents.find((a) => a.id === resp.agentId)
                  const orbitSeed = seed + ri
                  const orbitClass = floatClasses[orbitSeed % floatClasses.length]
                  return (
                    <button
                      key={ri}
                      onClick={() => {
                        promoteAgentResponse(insp.id, ri)
                      }}
                      style={{
                        position: 'absolute',
                        top: `${-10 - (ri % 3) * 18}px`,
                        right: `${-20 - (ri % 2) * 14}px`,
                        zIndex: 5 + ri,
                      }}
                      className={`bubble bubble-agent bubble-agent-${resp.agentId} ${orbitClass}`}
                      title={`${agent?.icon} ${agent?.name}: ${resp.content}\n点击采纳为灵感`}
                    >
                      <span className="mr-1 text-xs">{agent?.icon}</span>
                      <span className="truncate">{resp.content.slice(0, 30)}</span>
                    </button>
                  )
                })}
              </div>
            )
          })
        )}
      </div>

      {/* Quick add bar */}
      <div className="quick-add">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="捕捉一缕思绪..."
          autoFocus
        />
        <button onClick={handleAdd} disabled={!input.trim()} className="quick-add-btn">
          +
        </button>
      </div>

      {/* Selection mode bar */}
      {inspirations.length > 0 && (
        <div className="fixed top-[60px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2">
          <button
            onClick={() => {
              setSelectionMode(!selectionMode)
              if (selectionMode) setSelectedIds(new Set())
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectionMode
                ? 'bg-accent text-white'
                : 'bg-white/60 backdrop-blur border border-ink-200 text-ink-500'
            }`}
          >
            {selectionMode ? `已选 ${selectedIds.size}` : '遴选碎片'}
          </button>
          {selectionMode && selectedIds.size > 0 && (
            <button
              onClick={() => {
                navigate('/workshop', {
                  state: { preSelected: [...selectedIds] },
                })
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-ink-800 text-white hover:bg-ink-900 transition-colors"
            >
              进入工坊
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}

      {/* Expanded bubble modal */}
      {expanded && (
        <div className="bubble-expand-overlay" onClick={() => setExpandedId(null)}>
          <div className="bubble-expand-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <p className="text-lg text-ink-900 poem-text flex-1 whitespace-pre-wrap break-words">
                {expanded.content}
              </p>
              <button
                onClick={() => setExpandedId(null)}
                className="p-1.5 text-ink-400 hover:text-ink-600 transition-colors cursor-pointer shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-ink-400 mb-4">
              {new Date(expanded.createdAt).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>

            {!hasApiKey ? (
              <p className="text-sm text-ink-400">请在设置中配置 API Key 以召唤 AI 专家</p>
            ) : (
              <>
                <p className="text-xs text-ink-400 mb-2">召唤 AI 专家</p>
                <div className="agent-ring">
                  {agents.map((agent) => {
                    const isLoading = loadingAgent === `${expanded.id}:${agent.id}`
                    return (
                      <button
                        key={agent.id}
                        onClick={() => handleCallAgent(expanded.id, agent.id)}
                        disabled={loadingAgent !== null}
                        className={`agent-dot ${isLoading ? 'loading' : ''}`}
                        title={agent.description}
                      >
                        {isLoading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <span>{agent.icon}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-red-500 mt-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            {expanded.responses.length > 0 && (
              <div className="mt-5 pt-4 border-t border-ink-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-ink-400">AI 生成的碎片气泡（点击采纳）</p>
                  <button
                    onClick={() => clearAgentResponses(expanded.id)}
                    className="text-xs text-ink-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    清除
                  </button>
                </div>
                <div className="space-y-2">
                  {expanded.responses.map((resp, idx) => {
                    const agent = agents.find((a) => a.id === resp.agentId)
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          promoteAgentResponse(expanded.id, idx)
                          setExpandedId(null)
                        }}
                        className={`w-full text-left p-3 rounded-xl border text-sm leading-relaxed transition-all cursor-pointer bubble-agent-${resp.agentId}`}
                        style={{
                          background: 'rgba(255,255,255,0.5)',
                          borderWidth: '1.5px',
                        }}
                      >
                        <p className="text-xs text-ink-400 mb-1">
                          {agent?.icon} {agent?.name}
                        </p>
                        <p className="text-ink-700 whitespace-pre-wrap">{resp.content}</p>
                        <p className="text-xs text-accent mt-2">点击采纳 → 变成你的气泡</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-ink-200 flex justify-between">
              <button
                onClick={() => {
                  toggleSelect(expanded.id)
                  setExpandedId(null)
                  setSelectionMode(true)
                }}
                className="text-sm text-ink-500 hover:text-accent transition-colors cursor-pointer"
              >
                <Sparkles size={14} className="inline mr-1" />
                {selectedIds.has(expanded.id) ? '已标记' : '遴选此碎片'}
              </button>
              <button
                onClick={() => {
                  removeInspiration(expanded.id)
                  setExpandedId(null)
                }}
                className="text-sm text-ink-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
