import { useState } from 'react'
import { Download, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'
import LyraMark from './LyraMark'
import { MODEL_PRESETS } from '../core'
import type { ActionKind, AgentSettings, PermissionMode } from '../core'
import { PERMISSION_LABEL } from '../format'

type Props = {
  settings: AgentSettings
  onSave: (next: AgentSettings & { apiKey: string }) => void
  onExport: () => void
  onImport: () => void
  onClose: () => void
}

const PERMISSION_KINDS: { kind: ActionKind; label: string; hint: string }[] = [
  { kind: 'open_url', label: '打开外部网页', hint: '自动批准后，天琴可以直接在浏览器打开网页。' },
  { kind: 'fetch_url', label: '读取网页内容', hint: '自动批准后，天琴可以读取网页正文作为参考。' },
  { kind: 'read_file', label: '读取本地文件', hint: '自动批准后，天琴可以读取本机文本文件。' },
  { kind: 'write_file', label: '写入本地文件', hint: '自动批准后，天琴可以直接写入文件（系统目录始终被拒绝）。' },
]

export default function SettingsDialog({ settings, onSave, onExport, onImport, onClose }: Props) {
  const [endpoint, setEndpoint] = useState(settings.endpoint)
  const [model, setModel] = useState(settings.model)
  const [apiKey, setApiKey] = useState('')
  const [permissions, setPermissions] = useState(settings.permissions)
  const [interests, setInterests] = useState<string[]>(settings.interests)
  const [interestDraft, setInterestDraft] = useState('')
  const [error, setError] = useState('')

  const submit = () => {
    try {
      const url = new URL(endpoint.trim())
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('接口地址必须以 http 或 https 开头。')
      if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('远程接口必须使用 https 地址。')
    } catch {
      setError('接口地址不正确，请填写完整地址，例如 https://api.deepseek.com/v1/chat/completions')
      return
    }
    if (!model.trim()) {
      setError('请填写模型名称。')
      return
    }
    onSave({ endpoint: endpoint.trim(), model: model.trim(), apiKey: apiKey.trim(), permissions, interests })
  }

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="天琴设置" onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="dialog settings-dialog" onClick={event => event.stopPropagation()}>
        <header className="dialog-head">
          <div>
            <h2>设置</h2>
            <p>模型接入、操作权限与数据管理。所有数据保存在本机，接口密钥只存在于当前会话的内存中。</p>
          </div>
          <button className="icon-btn" type="button" onClick={onClose} title="关闭"><X size={16} /></button>
        </header>

        <div className="dialog-body">
          <section className="settings-section">
            <h3>模型接入</h3>
            <div className="preset-row">
              {MODEL_PRESETS.map(preset => (
                <button key={preset.label} className="chip" type="button" onClick={() => { setEndpoint(preset.endpoint); setModel(preset.model) }}>
                  {preset.label}
                </button>
              ))}
            </div>
            <label className="field">
              <span>接口地址</span>
              <input value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://api.deepseek.com/v1/chat/completions" spellCheck={false} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>模型名称</span>
                <input value={model} onChange={event => setModel(event.target.value)} placeholder="deepseek-chat" spellCheck={false} />
              </label>
              <label className="field">
                <span>接口密钥</span>
                <input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="只保存在当前会话内存中" autoComplete="off" />
              </label>
            </div>
          </section>

          <section className="settings-section">
            <h3><ShieldCheck size={15} /> 操作权限</h3>
            <p className="hint">对应天琴的四类外部操作。选择「自动批准」的操作不再逐条确认，但每一次执行仍会完整记入审计。</p>
            <div className="perm-rows">
              {PERMISSION_KINDS.map(item => (
                <div key={item.kind} className="perm-row">
                  <div className="perm-info">
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </div>
                  <div className="segmented small">
                    {(['ask', 'auto'] as PermissionMode[]).map(mode => (
                      <button key={mode} className={permissions[item.kind] === mode ? 'active' : ''} type="button" onClick={() => setPermissions(current => ({ ...current, [item.kind]: mode }))}>
                        {PERMISSION_LABEL[mode]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3><Sparkles size={15} /> 兴趣关键词</h3>
            <p className="hint">用于「今日简报」与「想法」生成，让建议更贴近你关注的领域。</p>
            <div className="chip-row">
              {interests.map((item, index) => (
                <span key={`${item}-${index}`} className="chip removable">
                  {item}
                  <button type="button" onClick={() => setInterests(current => current.filter((_, i) => i !== index))} title="移除"><X size={12} /></button>
                </span>
              ))}
            </div>
            <div className="interest-add">
              <input
                value={interestDraft}
                onChange={event => setInterestDraft(event.target.value)}
                onKeyDown={event => {
                  if (event.key !== 'Enter') return
                  const value = interestDraft.trim()
                  if (!value || interests.includes(value)) return
                  setInterests(current => [...current, value])
                  setInterestDraft('')
                }}
                placeholder="输入关键词后回车，例如：人工智能、长跑、写作"
              />
            </div>
          </section>

          <section className="settings-section">
            <h3>数据</h3>
            <p className="hint">导出包含会话、目标、任务、记忆、资料与审计记录的完整备份；密钥不会包含在内。</p>
            <div className="data-actions">
              <button className="ghost-btn" type="button" onClick={onExport}><Download size={14} /><span>导出工作台</span></button>
              <button className="ghost-btn" type="button" onClick={onImport}><Upload size={14} /><span>导入备份</span></button>
            </div>
          </section>

          <section className="settings-section about-block">
            <div className="about-brand">
              <LyraMark size={44} />
              <div>
                <strong>天琴 Lyra</strong>
                <span>0.2.0 · 你的私人 AI 智能体</span>
              </div>
            </div>
            <p className="hint">缪斯拨动琴弦给人灵感，天琴替你把事情做完。数据只保存在本机；打开网页、读写文件必须经过审批或明确的自动批准设置，全程审计可查。</p>
          </section>

          {error ? <p className="error-text">{error}</p> : null}
        </div>

        <footer className="dialog-foot">
          <button className="ghost-btn" type="button" onClick={onClose}>取消</button>
          <button className="primary-btn" type="button" onClick={submit}>保存设置</button>
        </footer>
      </div>
    </div>
  )
}
