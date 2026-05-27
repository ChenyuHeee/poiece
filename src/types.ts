export interface AgentResponse {
  agentId: string
  content: string
  timestamp: number
}

export interface Inspiration {
  id: string
  content: string
  tags: string[]
  createdAt: number
  responses: AgentResponse[]
}

export interface PoemDraft {
  id: string
  title: string
  content: string
  sourceIds: string[]
  createdAt: number
  updatedAt: number
}

export interface AgentDef {
  id: string
  name: string
  icon: string
  description: string
  systemPrompt: string
  userPromptTemplate: (input: string, context: string) => string
}

export interface Settings {
  apiKey: string
  apiBase: string
  model: string
}
