import type { Settings } from '../types'

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  apiBase: 'https://api.deepseek.com',
  model: 'deepseek-v4-pro',
}

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem('poiece-settings')
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {}
  return DEFAULT_SETTINGS
}

export function saveSettings(s: Settings) {
  localStorage.setItem('poiece-settings', JSON.stringify(s))
}

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
): Promise<string> {
  const settings = getSettings()
  if (!settings.apiKey) throw new Error('请先在设置中配置 API Key')

  const res = await fetch(`${settings.apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 1024,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
    throw new Error(err.error?.message || `API 请求失败 (${res.status})`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}
