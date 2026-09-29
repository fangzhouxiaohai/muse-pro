import { useState } from 'react'
import { Brain, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import type { WorkspaceState } from '../core'
import { relativeTime } from '../format'

type Props = {
  state: WorkspaceState
  onAdd: (content: string) => void
  onForget: (id: string) => void
  onPin: (id: string) => void
}

export default function MemoryView({ state, onAdd, onForget, onPin }: Props) {
  const [draft, setDraft] = useState('')
  const ordered = [...state.memories].sort((a, b) => Number(b.pinned) - Number(a.pinned))

  const submit = () => {
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>记忆</h1>
          <p>天琴会在对话中自动沉淀长期有效的信息；置顶的记忆始终参与思考，也可以随时让它遗忘。</p>
        </div>
      </header>

      <div className="compose-bar">
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') submit() }}
          placeholder="手动添加一条记忆，例如：我对花生过敏"
        />
        <button className="primary-btn" type="button" onClick={submit} disabled={!draft.trim()}><Plus size={14} /><span>记住</span></button>
      </div>

      {state.memories.length === 0 ? (
        <div className="empty-state">
          <Brain size={28} />
          <h2>还没有记忆</h2>
          <p>对话中透露的长期偏好、背景与承诺会被自动记在这里；你也可以在上方手动添加。</p>
        </div>
      ) : (
        <div className="memory-list">
          {ordered.map(memory => (
            <article key={memory.id} className={`memory-card${memory.pinned ? ' pinned' : ''}`}>
              <div className="memory-body">
                <p>{memory.content}</p>
                <footer>
                  <span className="memory-source">{memory.source}</span>
                  <em>{relativeTime(memory.createdAt)}</em>
                </footer>
              </div>
              <div className="memory-actions">
                <button className="icon-btn" type="button" onClick={() => onPin(memory.id)} title={memory.pinned ? '取消置顶' : '置顶'}>
                  {memory.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                </button>
                <button className="icon-btn danger" type="button" onClick={() => onForget(memory.id)} title="遗忘这条记忆"><Trash2 size={14} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
