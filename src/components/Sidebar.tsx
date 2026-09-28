import { useMemo, useState } from 'react'
import {
  Database,
  PanelLeftClose,
  FileText,
  Flag,
  ListChecks,
  MessageSquare,
  Plus,
  ScrollText,
  Search,
  Settings,
  Trash2,
  Waypoints,
} from 'lucide-react'
import type { View, WorkspaceState } from '../core'
import { initialOf } from '../format'

type Props = {
  state: WorkspaceState
  view: View
  onView: (view: View) => void
  onSelect: (id: string) => void
  onNew: () => void
  onRemove: (id: string) => void
  onSettings: () => void
  onClose: () => void
}

const NAV: { key: View; label: string; icon: typeof MessageSquare }[] = [
  { key: 'chat', label: '对话', icon: MessageSquare },
  { key: 'tasks', label: '任务', icon: ListChecks },
  { key: 'goals', label: '目标', icon: Flag },
  { key: 'files', label: '资料', icon: FileText },
  { key: 'actions', label: '行动', icon: Waypoints },
  { key: 'audit', label: '审计', icon: ScrollText },
]

export default function Sidebar({ state, view, onView, onSelect, onNew, onRemove, onSettings, onClose }: Props) {
  const [keyword, setKeyword] = useState('')

  const sessions = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    if (!query) return state.sessions
    return state.sessions.filter(session => {
      if (session.title.toLowerCase().includes(query)) return true
      return session.messages.some(message => message.content.toLowerCase().includes(query))
    })
  }, [state.sessions, keyword])

  const pendingCount = state.approvals.filter(item => item.status === 'pending').length
  const counters: Record<View, number> = {
    chat: state.sessions.length,
    tasks: state.tasks.length,
    goals: state.goals.length,
    files: state.files.length,
    actions: state.actions.length,
    audit: state.audit.length,
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true"><Database size={18} /></div>
        <div className="brand-text">
          <strong>Muse Pro</strong>
          <span>个人 AI 工作台</span>
        </div>
        <button className="icon-btn sidebar-close" type="button" onClick={onClose} title="收起导航"><PanelLeftClose size={15} /></button>
      </div>

      <nav className="nav">
        {NAV.map(item => (
          <button key={item.key} className={`nav-item${view === item.key ? ' active' : ''}`} type="button" onClick={() => onView(item.key)}>
            <item.icon size={17} />
            <span>{item.label}</span>
            {item.key === 'actions' && pendingCount > 0
              ? <em className="badge">{pendingCount}</em>
              : counters[item.key] > 0 ? <em className="count">{counters[item.key]}</em> : null}
          </button>
        ))}
      </nav>

      <section className="session-block">
        <header className="block-head">
          <span>对话记录</span>
          <button className="icon-btn" type="button" onClick={onNew} title="新建对话"><Plus size={15} /></button>
        </header>

        <label className="search-field">
          <Search size={14} />
          <input value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="搜索对话内容" />
        </label>

        <div className="session-list">
          {sessions.length === 0 ? <p className="empty-hint">没有匹配的对话。</p> : null}
          {sessions.map(session => (
            <div key={session.id} className={`session-item${session.id === state.activeSessionId ? ' active' : ''}`}>
              <button className="session-main" type="button" onClick={() => onSelect(session.id)}>
                <span className="session-avatar">{initialOf(session.title)}</span>
                <span className="session-text">
                  <strong>{session.title}</strong>
                  <small>{session.messages.length} 条消息</small>
                </span>
              </button>
              {state.sessions.length > 1 ? (
                <button className="icon-btn session-remove" type="button" onClick={() => onRemove(session.id)} title="移除这条对话"><Trash2 size={14} /></button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <footer className="sidebar-foot">
        <button className="ghost-btn wide" type="button" onClick={onSettings}><Settings size={15} /><span>模型设置</span></button>
      </footer>
    </aside>
  )
}
