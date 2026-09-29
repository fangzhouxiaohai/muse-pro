import { useEffect, useMemo, useRef, useState } from 'react'
import { Brain, Flag, FolderOpen, Lightbulb, MessageSquare, ScrollText, Search } from 'lucide-react'
import type { SearchHit, WorkspaceState } from '../core'
import { searchWorkspace } from '../core'

type Props = {
  state: WorkspaceState
  onClose: () => void
  onNavigate: (hit: SearchHit) => void
}

const VIEW_ICON = {
  chat: MessageSquare,
  goals: Flag,
  ideas: Lightbulb,
  memory: Brain,
  files: FolderOpen,
  audit: ScrollText,
} as const

const VIEW_LABEL: Record<SearchHit['view'], string> = {
  chat: '对话',
  goals: '目标',
  ideas: '想法',
  memory: '记忆',
  files: '资料库',
  audit: '审计',
}

export default function SearchDialog({ state, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const hits = useMemo(() => searchWorkspace(state, query), [state, query])

  return (
    <div className="dialog-backdrop search-backdrop" role="presentation" onClick={onClose}>
      <div className="dialog search-dialog" role="dialog" aria-modal="true" aria-label="全局搜索" onClick={event => event.stopPropagation()}>
        <label className="search-field big">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索对话、目标、任务、记忆、资料与审计记录"
          />
        </label>
        <div className="search-results">
          {query.trim() && hits.length === 0 ? <p className="empty-hint">没有找到与「{query.trim()}」相关的内容。</p> : null}
          {!query.trim() ? <p className="empty-hint">输入关键词开始搜索，支持对话、目标、任务、记忆、资料与审计。</p> : null}
          {hits.map(hit => {
            const Icon = VIEW_ICON[hit.view]
            return (
              <button key={`${hit.view}-${hit.id}`} className="search-hit" type="button" onClick={() => onNavigate(hit)}>
                <span className="hit-icon"><Icon size={14} /></span>
                <span className="hit-body">
                  <strong>{hit.title}</strong>
                  <small>{hit.snippet}</small>
                </span>
                <em>{VIEW_LABEL[hit.view]}</em>
              </button>
            )
          })}
        </div>
        <footer className="search-foot">
          <span><kbd>Esc</kbd> 关闭</span>
          <span><kbd>Ctrl</kbd> <kbd>K</kbd> 随时打开</span>
        </footer>
      </div>
    </div>
  )
}
