import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ModelSettings } from '../core'
import { isTauri } from '@tauri-apps/api/core'

type Props = {
  settings: ModelSettings
  onSave: (settings: ModelSettings) => void
  onClose: () => void
}

const PRESETS = [
  { label: '深度求索', endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
  { label: '月之暗面', endpoint: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
  { label: '本地 Ollama', endpoint: 'http://localhost:11434/v1/chat/completions', model: 'qwen2.5:7b' },
]

export default function SettingsDialog({ settings, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<ModelSettings>(settings)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = () => {
    if (!draft.endpoint.trim()) { setError('请填写模型接口地址。'); return }
    if (!draft.model.trim()) { setError('请填写模型名称。'); return }
    if (!draft.apiKey.trim()) { setError('请填写接口密钥。'); return }
    onSave({ endpoint: draft.endpoint.trim(), model: draft.model.trim(), apiKey: draft.apiKey.trim() })
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="模型设置">
      <div className="dialog">
        <header className="dialog-head">
          <div>
            <h2>模型设置</h2>
            <p>密钥只保存在当前设备的内存中，关闭工作台后不会留存。</p>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} title="关闭"><X size={16} /></button>
        </header>

        <section className="dialog-body">
          <div className="preset-row">
            {PRESETS.map(preset => (
              <button key={preset.label} className="chip" type="button" onClick={() => setDraft({ ...draft, endpoint: preset.endpoint, model: preset.model })}>
                {preset.label}
              </button>
            ))}
          </div>

          <label className="field">
            <span>接口地址</span>
            <input value={draft.endpoint} onChange={event => setDraft({ ...draft, endpoint: event.target.value })} placeholder="https://api.example.com/v1/chat/completions" spellCheck={false} />
          </label>

          <label className="field">
            <span>模型名称</span>
            <input value={draft.model} onChange={event => setDraft({ ...draft, model: event.target.value })} placeholder="例如 deepseek-chat" spellCheck={false} />
          </label>

          <label className="field">
            <span>接口密钥</span>
            <input type="password" value={draft.apiKey} onChange={event => setDraft({ ...draft, apiKey: event.target.value })} placeholder="仅本次会话有效" spellCheck={false} />
          </label>

          <p className="hint">
            {isTauri()
              ? '桌面版通过系统网络层发起请求，不受浏览器跨域限制。'
              : '网页版受浏览器跨域限制，模型接口需要允许来自当前页面的请求。'}
          </p>

          {error ? <p className="error-text">{error}</p> : null}
        </section>

        <footer className="dialog-foot">
          <button className="ghost-btn" type="button" onClick={onClose}>取消</button>
          <button className="primary-btn" type="button" onClick={submit}>保存设置</button>
        </footer>
      </div>
    </div>
  )
}
