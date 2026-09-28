import { useMemo, useState } from 'react'
import { Check, Circle, Plus, Trash2 } from 'lucide-react'
import { relativeTime, type Item } from '../core'

type Props = {
  collection: 'tasks' | 'goals'
  items: Item[]
  onCreate: (collection: 'tasks' | 'goals', title: string) => void
  onToggle: (collection: 'tasks' | 'goals', id: string) => void
  onNote: (collection: 'tasks' | 'goals', id: string, note: string) => void
  onRemove: (collection: 'tasks' | 'goals', id: string) => void
}

const COPY = {
  tasks: { title: '任务', hint: '把正在推进的事记下来，完成一项就勾掉一项。', placeholder: '新增任务，例如 整理季度复盘材料' },
  goals: { title: '目标', hint: '写下你正在靠近的方向，任务应该服务于它们。', placeholder: '新增目标，例如 建立稳定的写作节奏' },
} as const

export default function ItemsView({ collection, items, onCreate, onToggle, onNote, onRemove }: Props) {
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('all')
  const [editing, setEditing] = useState<string | null>(null)

  const copy = COPY[collection]
  const done = items.filter(item => item.done).length
  const percent = items.length ? Math.round((done / items.length) * 100) : 0

  const visible = useMemo(() => {
    if (filter === 'open') return items.filter(item => !item.done)
    if (filter === 'done') return items.filter(item => item.done)
    return items
  }, [items, filter])

  const submit = () => {
    if (!draft.trim()) return
    onCreate(collection, draft.trim())
    setDraft('')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>{copy.title}</h1>
          <p>{copy.hint}</p>
        </div>
        <div className="progress-ring" title={`完成度 ${percent}%`}>
          <svg viewBox="0 0 42 42" width="46" height="46">
            <circle cx="21" cy="21" r="17" fill="none" stroke="var(--line)" strokeWidth="4" />
            <circle
              cx="21" cy="21" r="17" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${(percent / 100) * 106.8} 106.8`} transform="rotate(-90 21 21)"
            />
          </svg>
          <span>{percent}%</span>
        </div>
      </header>

      <section className="compose-bar">
        <input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') submit() }} placeholder={copy.placeholder} />
        <button className="primary-btn" type="button" onClick={submit}><Plus size={15} /><span>添加</span></button>
      </section>

      <div className="segmented filter">
        <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>全部 {items.length}</button>
        <button className={filter === 'open' ? 'active' : ''} type="button" onClick={() => setFilter('open')}>进行中 {items.length - done}</button>
        <button className={filter === 'done' ? 'active' : ''} type="button" onClick={() => setFilter('done')}>已完成 {done}</button>
      </div>

      <div className="item-list">
        {visible.length === 0 ? <p className="empty-hint">这里暂时没有内容。</p> : null}
        {visible.map(item => (
          <article key={item.id} className={`item-row${item.done ? ' done' : ''}`}>
            <button className="check-btn large" type="button" onClick={() => onToggle(collection, item.id)} title={item.done ? '重新开始' : '标记完成'}>
              {item.done ? <Check size={14} /> : <Circle size={14} />}
            </button>
            <div className="item-body">
              <strong>{item.title}</strong>
              {editing === item.id ? (
                <input
                  autoFocus
                  defaultValue={item.note}
                  placeholder="补充一句备注"
                  onBlur={event => { onNote(collection, item.id, event.target.value); setEditing(null) }}
                  onKeyDown={event => { if (event.key === 'Enter') { onNote(collection, item.id, event.currentTarget.value); setEditing(null) } }}
                />
              ) : (
                <button className="note-btn" type="button" onClick={() => setEditing(item.id)}>
                  {item.note ? item.note : '添加备注'}
                </button>
              )}
              <small>创建于 {relativeTime(item.createdAt)}</small>
            </div>
            <button className="icon-btn" type="button" onClick={() => onRemove(collection, item.id)} title="删除"><Trash2 size={14} /></button>
          </article>
        ))}
      </div>
    </div>
  )
}
