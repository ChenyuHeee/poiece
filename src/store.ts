import { create } from 'zustand'
import type { Inspiration, PoemDraft } from './types'
import { agents } from './agents/defs'

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function save<T>(key: string, val: T) {
  localStorage.setItem(key, JSON.stringify(val))
}

let idCounter = Date.now()

function uid(): string {
  return (++idCounter).toString(36)
}

interface Store {
  inspirations: Inspiration[]
  poems: PoemDraft[]

  addInspiration: (content: string, tags: string[]) => void
  removeInspiration: (id: string) => void
  updateInspiration: (id: string, content: string, tags: string[]) => void
  addAgentResponses: (inspirationId: string, responses: { agentId: string; title: string; content: string }[]) => void
  removeAgentResponse: (inspirationId: string, responseIndex: number) => void
  clearAgentResponses: (inspirationId: string) => void
  promoteAgentResponse: (inspirationId: string, responseIndex: number) => void
  cleanupExpiredResponses: (maxAgeMs?: number, maxTotal?: number) => void

  savePoem: (title: string, content: string, sourceIds: string[]) => void
  updatePoem: (id: string, title: string, content: string) => void
  removePoem: (id: string) => void
}

export const useStore = create<Store>((set, get) => ({
  inspirations: load<Inspiration[]>('poiece-inspirations', []),
  poems: load<PoemDraft[]>('poiece-poems', []),

  addInspiration: (content, tags) => {
    const insp: Inspiration = {
      id: uid(),
      content,
      tags,
      createdAt: Date.now(),
      responses: [],
    }
    const next = [insp, ...get().inspirations]
    save('poiece-inspirations', next)
    set({ inspirations: next })
  },

  removeInspiration: (id) => {
    const next = get().inspirations.filter((i) => i.id !== id)
    save('poiece-inspirations', next)
    set({ inspirations: next })
  },

  updateInspiration: (id, content, tags) => {
    const next = get().inspirations.map((i) =>
      i.id === id ? { ...i, content, tags } : i
    )
    save('poiece-inspirations', next)
    set({ inspirations: next })
  },

  addAgentResponses: (inspirationId, resps) => {
    const now = Date.now()
    const next = get().inspirations.map((i) =>
      i.id === inspirationId
        ? {
            ...i,
            responses: [
              ...i.responses,
              ...resps.map((r) => ({
                agentId: r.agentId,
                title: r.title,
                content: r.content,
                timestamp: now,
              })),
            ],
          }
        : i
    )
    save('poiece-inspirations', next)
    set({ inspirations: next })
  },

  removeAgentResponse: (inspirationId, responseIndex) => {
    const next = get().inspirations.map((i) =>
      i.id === inspirationId
        ? { ...i, responses: i.responses.filter((_, idx) => idx !== responseIndex) }
        : i
    )
    save('poiece-inspirations', next)
    set({ inspirations: next })
  },

  clearAgentResponses: (inspirationId) => {
    const next = get().inspirations.map((i) =>
      i.id === inspirationId ? { ...i, responses: [] } : i
    )
    save('poiece-inspirations', next)
    set({ inspirations: next })
  },

  promoteAgentResponse: (inspirationId, responseIndex) => {
    const state = get()
    const insp = state.inspirations.find((i) => i.id === inspirationId)
    if (!insp) return
    const resp = insp.responses[responseIndex]
    if (!resp) return

    const agent = agents.find((a) => a.id === resp.agentId)
    const newInsp: Inspiration = {
      id: uid(),
      content: resp.content,
      tags: [agent?.name || resp.agentId, '来自AI'],
      createdAt: Date.now(),
      responses: [],
    }
    const nextInspirations = [newInsp, ...state.inspirations]
    save('poiece-inspirations', nextInspirations)
    set({ inspirations: nextInspirations })
  },

  cleanupExpiredResponses: (maxAgeMs = 3 * 60 * 1000, maxTotal = 20) => {
    const state = get()
    const now = Date.now()
    let totalRemaining = 0

    // First pass: count total and remove expired
    const afterAge = state.inspirations.map((insp) => {
      const filtered = insp.responses.filter((r) => now - r.timestamp < maxAgeMs)
      totalRemaining += filtered.length
      if (filtered.length === insp.responses.length) return insp
      return { ...insp, responses: filtered }
    })

    // Second pass: if still over max, remove oldest
    if (totalRemaining > maxTotal) {
      // Collect all responses with their location
      interface Entry { inspIdx: number; respIdx: number; ts: number }
      const all: Entry[] = []
      afterAge.forEach((insp, i) => {
        insp.responses.forEach((r, j) => all.push({ inspIdx: i, respIdx: j, ts: r.timestamp }))
      })
      all.sort((a, b) => a.ts - b.ts)
      const toRemove = all.slice(0, totalRemaining - maxTotal)
      const removeSet = new Set<string>()
      toRemove.forEach((e) => removeSet.add(`${e.inspIdx}:${e.respIdx}`))

      const final = afterAge.map((insp, i) => {
        const filtered = insp.responses.filter((_, j) => !removeSet.has(`${i}:${j}`))
        return { ...insp, responses: filtered }
      })
      save('poiece-inspirations', final)
      set({ inspirations: final })
    } else {
      save('poiece-inspirations', afterAge)
      set({ inspirations: afterAge })
    }
  },

  savePoem: (title, content, sourceIds) => {
    const now = Date.now()
    const poem: PoemDraft = {
      id: uid(),
      title,
      content,
      sourceIds,
      createdAt: now,
      updatedAt: now,
    }
    const next = [poem, ...get().poems]
    save('poiece-poems', next)
    set({ poems: next })
  },

  updatePoem: (id, title, content) => {
    const next = get().poems.map((p) =>
      p.id === id ? { ...p, title, content, updatedAt: Date.now() } : p
    )
    save('poiece-poems', next)
    set({ poems: next })
  },

  removePoem: (id) => {
    const next = get().poems.filter((p) => p.id !== id)
    save('poiece-poems', next)
    set({ poems: next })
  },
}))
