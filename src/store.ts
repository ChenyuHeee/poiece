import { create } from 'zustand'
import type { Inspiration, PoemDraft } from './types'

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
  addAgentResponse: (inspirationId: string, response: { agentId: string; content: string }) => void
  clearAgentResponses: (inspirationId: string) => void

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

  addAgentResponse: (inspirationId, resp) => {
    const next = get().inspirations.map((i) =>
      i.id === inspirationId
        ? {
            ...i,
            responses: [
              ...i.responses,
              { agentId: resp.agentId, content: resp.content, timestamp: Date.now() },
            ],
          }
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
