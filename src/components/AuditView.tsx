import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import type { AuditEvent, WorkspaceState } from '../core'
import { ACTIONABLE_KINDS, pendingApprovals } from '../core'
import ApprovalBar from './ApprovalBar'
import { EVENT_LABEL, dayTime } from '../format'

type Props = {
  state: WorkspaceState
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

type Filter = 'all' | 'actions' | 'approvals' | 'chats'

const FILTER_LABEL: Record<Filter, string> = {
  all: '全部',
  actions: '行动记录',
  approvals: '审批',
  chats: '对话',
}

function kindOf(event: AuditEvent): Filter {
  if (event.kind.startsWith('approval_')) return 'approvals'
  if (event.kind === 'message_sent' || event.kind === 'response_received' || event.kind === 'session_created' || event.kind === 'session_removed') return 'chats'
  if (ACTIONABLE_KINDS.includes(event.kind)) return 'actions'
  return 'all'
}

export default function AuditView({ state, onApprove, onReject }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const pending = pendingApprovals(state)
  const timeline = [...state.audit].reverse().filter(event => {
    if (filter === 'all') return true
    return kindOf(event) === filter
  })

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>审计</h1>
          <p>天琴做过的每一步、提出的每个请求都按时间留在这里：已执行的、被拒绝的、等待你确认的，全部可追溯。</p>
        </div>
        {pending.length ? <em className="pending-count">{pending.length} 项待确认</em> : null}
      </header>

      {pending.length ? <ApprovalBar approvals={pending} onApprove={onApprove} onReject={onReject} /> : null}

      <div className="segmented filter audit-filter">
        {(Object.keys(FILTER_LABEL) as Filter[]).map(key => (
          <button key={key} className={filter === key ? 'active' : ''} type="button" onClick={() => setFilter(key)}>{FILTER_LABEL[key]}</button>
        ))}
      </div>

      {timeline.length === 0 ? (
        <div className="empty-state">
          <ScrollText size={28} />
          <h2>还没有记录</h2>
          <p>开始一次对话，或让天琴执行一个操作，这里就会出现完整的时间线。</p>
        </div>
      ) : (
        <ol className="timeline">
          {timeline.map(event => (
            <li key={event.id} className="timeline-item">
              <span className="timeline-dot" />
              <div className="timeline-body">
                <header>
                  <strong>{event.title}</strong>
                  <span className="event-kind">{EVENT_LABEL[event.kind]}</span>
                  <small>{dayTime(event.createdAt)}</small>
                </header>
                <p>{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
