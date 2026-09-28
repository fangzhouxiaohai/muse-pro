import { useState } from 'react'
import { Check, FileText, Flag, ListChecks, Plus, X } from 'lucide-react'
import { formatSize, relativeTime, type WorkspaceState } from '../core'
import { FILE_LABEL } from '../format'

type Props = {
  state: WorkspaceState
  onCreate: (collection: 'tasks' | 'goals', title: string) => void
  onToggle: (collection: 'tasks' | 'goals', id: string) => void
  onOpenFile: (id: string) => void
  onView: (view: 'files') => void
}

export default function ContextPanel({ state, onCreate, onToggle, onOpenFile, onView }: Props) {
  const [draft, setDraft] = useState('')
  const [target, setTarget] = useState<'tasks' | 'goals'>('tasks')

  const submit = () => {
    if (!draft.trim()) return
    onCreate(target, draft)
    setDraft('')
  }

  return (
    <aside className="context-panel" aria-label="工作区上下文">
      <section className="context-block">
        <header className="block-head">
          <span><ListChecks size={14} /> 任务</span>
          <em className="count">{state.tasks.filter(item => !item.done).length} 项待推进</em>
        </header>
        <div className="context-list">
          {state.tasks.length === 0 ? <p className="empty-hint">还没有任务，先记下第一件要做的事。</p> : null}
          {state.tasks.slice(-6).reverse().map(item => (
            <label key={item.id} className={`mini-item${item.done ? ' done' : ''}`}>
              <button className="check-btn" type="button" onClick={() => onToggle('tasks', item.id)} title={item.done ? '重新开始' : '标记完成'}>
                {item.done ? <Check size={12} /> : null}
              </button>
              <span>{item.title}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="context-block">
        <header className="block-head">
          <span><Flag size={14} /> 目标</span>
          <em className="count">{state.goals.length} 项</em>
        </header>
        <div className="context-list">
          {state.goals.length === 0 ? <p className="empty-hint">还没有目标，写下你正在推进的方向。</p> : null}
          {state.goals.slice(-4).reverse().map(item => (
            <label key={item.id} className={`mini-item${item.done ? ' done' : ''}`}>
              <button className="check-btn" type="button" onClick={() => onToggle('goals', item.id)} title={item.done ? '重新开始' : '标记完成'}>
                {item.done ? <Check size={12} /> : null}
              </button>
              <span>{item.title}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="context-block">
        <header className="block-head">
          <span><FileText size={14} /> 资料</span>
          <button className="link-btn" type="button" onClick={() => onView('files')}>全部</button>
        </header>
        <div className="context-list">
          {state.files.length === 0 ? <p className="empty-hint">还没有资料，可以在资料页添加本地文件。</p> : null}
          {state.files.slice(-4).reverse().map(file => (
            <button key={file.id} className="mini-file" type="button" onClick={() => onOpenFile(file.id)}>
              <span className="file-tag">{FILE_LABEL[file.kind]}</span>
              <span className="file-name">{file.name}</span>
              <small>{formatSize(file.size)}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="context-block">
        <header className="block-head"><span><Plus size={14} /> 快速记录</span></header>
        <div className="quick-add">
          <div className="segmented">
            <button className={target === 'tasks' ? 'active' : ''} type="button" onClick={() => setTarget('tasks')}>任务</button>
            <button className={target === 'goals' ? 'active' : ''} type="button" onClick={() => setTarget('goals')}>目标</button>
          </div>
          <textarea value={draft} onChange={event => setDraft(event.target.value)} placeholder="写一句就能收进清单" rows={2} />
          <div className="quick-actions">
            <button className="ghost-btn small" type="button" onClick={() => setDraft('')}><X size={13} />清空</button>
            <button className="primary-btn small" type="button" onClick={submit}>收进清单</button>
          </div>
        </div>
        <p className="context-foot">最近更新：{state.audit.length ? relativeTime(state.audit[state.audit.length - 1].createdAt) : '暂无记录'}</p>
      </section>
    </aside>
  )
}
