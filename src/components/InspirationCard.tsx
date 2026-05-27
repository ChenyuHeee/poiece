import { useState, useRef } from 'react'
import { Trash2, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react'
import type { Inspiration } from '../types'
import { agents } from '../agents/defs'
import { callLLM, getSettings } from '../lib/llm'
import { useStore } from '../store'

interface Props {
  inspiration: Inspiration
}

export default function InspirationCard({ inspiration }: Props) {
  const removeInspiration = useStore((s) => s.removeInspiration)
  const addAgentResponse = useStore((s) => s.addAgentResponse)
  const clearAgentResponses = useStore((s) => s.clearAgentResponses)
  const inspirations = useStore((s) => s.inspirations)

  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const context = inspirations
    .filter((i) => i.id !== inspiration.id)
    .slice(0, 5)
    .map((i) => i.content)
    .join(' / ')

  const handleCallAgent = async (agentId: string) => {
    const agent = agents.find((a) => a.id === agentId)
    if (!agent) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(agentId)
    setError('')
    try {
      const userPrompt = agent.userPromptTemplate(inspiration.content, context)
      const result = await callLLM(agent.systemPrompt, userPrompt, controller.signal)
      addAgentResponse(inspiration.id, { agentId, content: result })
    } catch (e: any) {
      if (e.name === 'AbortError') return
      setError(e.message)
    } finally {
      setLoading(null)
    }
  }

  const settings = getSettings()
  const hasApiKey = !!settings.apiKey

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-ink-900 poem-text text-base whitespace-pre-wrap break-words">
            {inspiration.content}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {inspiration.tags.map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
            <span className="text-xs text-ink-400 self-center ml-1">
              {new Date(inspiration.createdAt).toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-ink-400 hover:text-ink-600 transition-colors cursor-pointer"
            title="展开 AI 面板"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button
            onClick={() => removeInspiration(inspiration.id)}
            className="p-1.5 text-ink-300 hover:text-red-500 transition-colors cursor-pointer"
            title="删除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-ink-200">
          {!hasApiKey ? (
            <p className="text-sm text-ink-400">
              请先在「设置」中配置 API Key 以启用 AI 功能
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => handleCallAgent(agent.id)}
                    disabled={loading !== null}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors bg-ink-50 text-ink-600 hover:bg-ink-100 border border-ink-200 disabled:opacity-50 cursor-pointer disabled:cursor-default"
                  >
                    {loading === agent.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <span>{agent.icon}</span>
                    )}
                    {agent.name}
                  </button>
                ))}
                {inspiration.responses.length > 0 && (
                  <button
                    onClick={() => clearAgentResponses(inspiration.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-ink-400 hover:text-red-500 transition-colors cursor-pointer"
                  >
                    <X size={12} />
                    清除
                  </button>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-500 mb-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="space-y-3">
                {inspiration.responses.map((resp, idx) => {
                  const agent = agents.find((a) => a.id === resp.agentId)
                  return (
                    <div key={idx} className="agent-msg">
                      <p className="text-xs text-ink-400 mb-1">
                        {agent?.icon} {agent?.name || resp.agentId}
                      </p>
                      <p className="text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">
                        {resp.content}
                      </p>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
