import { useState, useEffect } from 'react'
import { getSettings, saveSettings } from '../lib/llm'
import type { Settings } from '../types'
import { Key, Globe, Cpu, Check, AlertCircle } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(getSettings())
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    setSettings(getSettings())
  }, [])

  const handleSave = () => {
    saveSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-ink-900 mb-2">设置</h1>
      <p className="text-ink-500 text-sm mb-6">
        配置 LLM API，启用 AI 辅助创作。数据均存储在你的浏览器中。
      </p>

      <div className="space-y-5 max-w-lg">
        <div className="card p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-2">
            <Key size={16} />
            API Key
          </label>
          <div className="flex gap-2">
            <input
              type={showKey ? 'text' : 'password'}
              value={settings.apiKey}
              onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
              placeholder="sk-..."
              className="flex-1 bg-ink-50 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink-900 outline-none focus:border-accent transition-colors font-mono"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-2 text-xs text-ink-500 hover:text-ink-700 transition-colors cursor-pointer"
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </div>
          <p className="text-xs text-ink-400 mt-2">
            兼容 OpenAI、DeepSeek、通义千问等兼容的 API。Key 仅存储在浏览器 localStorage 中。
          </p>
        </div>

        <div className="card p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-2">
            <Globe size={16} />
            API Base URL
          </label>
          <input
            type="text"
            value={settings.apiBase}
            onChange={(e) => setSettings({ ...settings, apiBase: e.target.value })}
            placeholder="https://api.openai.com/v1"
            className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink-900 outline-none focus:border-accent transition-colors font-mono"
          />
          <p className="text-xs text-ink-400 mt-2">
            默认 OpenAI 接口。使用 DeepSeek 填 https://api.deepseek.com/v1，通义千问填 https://dashscope.aliyuncs.com/compatible-mode/v1
          </p>
        </div>

        <div className="card p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-2">
            <Cpu size={16} />
            模型
          </label>
          <input
            type="text"
            value={settings.model}
            onChange={(e) => setSettings({ ...settings, model: e.target.value })}
            placeholder="gpt-4o-mini"
            className="w-full bg-ink-50 border border-ink-200 rounded-lg px-3 py-2 text-sm text-ink-900 outline-none focus:border-accent transition-colors font-mono"
          />
          <p className="text-xs text-ink-400 mt-2">
            推荐使用 gpt-4o-mini / deepseek-chat / qwen-turbo 等性价比模型
          </p>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors cursor-pointer"
        >
          {saved ? (
            <>
              <Check size={16} />
              已保存
            </>
          ) : (
            '保存设置'
          )}
        </button>
      </div>

      <div className="mt-10 p-4 bg-ink-50 rounded-xl border border-ink-200">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-2">
          <AlertCircle size={16} />
          关于 5 位 AI 专家
        </h2>
        <div className="space-y-2 text-sm text-ink-600">
          <p><strong>灵感师 ✨</strong> — 自由联想，提供意象和素材方向</p>
          <p><strong>意象师 🎨</strong> — 构建意象群，打通五感通感</p>
          <p><strong>炼字师 ⚒️</strong> — 推敲用词，提供精准的动词形容词</p>
          <p><strong>韵律师 🎵</strong> — 调整节奏、韵脚、音乐性</p>
          <p><strong>结构师 🏛️</strong> — 组织碎片，构建完整诗歌框架</p>
        </div>
        <p className="text-xs text-ink-400 mt-3">
          每位专家独立调用 LLM，各司其职，从不同维度辅助诗歌创作。
        </p>
      </div>
    </div>
  )
}
