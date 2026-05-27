import { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '../lib/llm'
import type { Settings } from '../types'
import { Check, ExternalLink } from 'lucide-react'

const MODEL_PRESETS = [
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro', base: 'https://api.deepseek.com' },
  { value: 'deepseek-chat', label: 'DeepSeek Chat (V3)', base: 'https://api.deepseek.com' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', base: 'https://api.openai.com/v1' },
  { value: 'gpt-4o', label: 'GPT-4o', base: 'https://api.openai.com/v1' },
  { value: 'qwen-turbo', label: 'Qwen Turbo', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { value: 'qwen-plus', label: 'Qwen Plus', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
]

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(getSettings())
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [customModel, setCustomModel] = useState(false)

  useEffect(() => {
    const s = getSettings(); setSettings(s)
    if (!MODEL_PRESETS.find((p) => p.value === s.model)) setCustomModel(true)
  }, [])

  const handleSave = () => { saveSettings(settings); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const handleModelSelect = (value: string) => {
    if (value === '__custom__') { setCustomModel(true); return }
    setCustomModel(false)
    const preset = MODEL_PRESETS.find((p) => p.value === value)
    if (preset) setSettings({ ...settings, model: preset.value, apiBase: preset.base })
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <h1 className="text-xl italic font-semibold text-ink mb-2" style={{ fontFamily: '"Cormorant Garamond", serif' }}>settings</h1>
      <p className="text-sm text-ink-dim/50 mb-6 italic">your key stays in your browser. nowhere else.</p>

      <div className="space-y-4 max-w-lg">
        {/* API Key */}
        <div className="settings-card p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-dim mb-2">
            <span className="text-amber">—</span> api key
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'} value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder="sk-..." className="flex-1 px-3 py-2 text-sm font-mono"
            />
            <button onClick={() => setShowKey(!showKey)} className="px-3 py-2 text-xs text-ink-dim hover:text-ink transition-colors cursor-pointer">
              {showKey ? 'hide' : 'show'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-xs text-amber/70 hover:text-amber transition-colors">
              deepseek keys <ExternalLink size={9} />
            </a>
            <span className="text-ink-dim/20">·</span>
            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-xs text-amber/70 hover:text-amber transition-colors">
              openai keys <ExternalLink size={9} />
            </a>
          </div>
        </div>

        {/* Model */}
        <div className="settings-card p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-dim mb-3">
            <span className="text-amber">—</span> model
          </label>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {MODEL_PRESETS.map((preset) => (
              <button key={preset.value} onClick={() => handleModelSelect(preset.value)}
                className={`text-left px-3 py-2 text-xs border transition-colors cursor-pointer ${
                  settings.model === preset.value && !customModel
                    ? 'border-amber/40 bg-amber/5 text-amber'
                    : 'border-white/5 bg-white/[0.02] text-ink-dim hover:border-white/10'
                }`}>
                <div className="font-medium">{preset.label}</div>
                <div className="text-[10px] text-ink-dim/40 truncate">{preset.value}</div>
              </button>
            ))}
            <button onClick={() => handleModelSelect('__custom__')}
              className={`text-left px-3 py-2 text-xs border transition-colors cursor-pointer ${
                customModel ? 'border-amber/40 bg-amber/5 text-amber' : 'border-white/5 bg-white/[0.02] text-ink-dim hover:border-white/10'
              }`}>
              <div className="font-medium">custom</div>
              <div className="text-[10px] text-ink-dim/40">other model</div>
            </button>
          </div>
          {customModel && (
            <input type="text" value={settings.model} onChange={(e) => setSettings({ ...settings, model: e.target.value })}
              placeholder="model name..." className="w-full px-3 py-2 text-sm font-mono" />
          )}
        </div>

        {/* API Base */}
        <div className="settings-card p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-dim mb-2">
            <span className="text-amber">—</span> api base url
          </label>
          <input type="text" value={settings.apiBase} onChange={(e) => setSettings({ ...settings, apiBase: e.target.value })}
            placeholder="https://api.deepseek.com" className="w-full px-3 py-2 text-sm font-mono" />
        </div>

        <button onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 text-sm text-amber border border-amber/40 hover:bg-amber/10 transition-colors cursor-pointer">
          {saved ? <><Check size={14} /> saved</> : 'save'}
        </button>
      </div>
    </div>
  )
}
