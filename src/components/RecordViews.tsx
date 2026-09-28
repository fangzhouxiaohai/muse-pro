import { useMemo, useState } from 'react'
import { CircleAlert, CircleCheck, CircleSlash, Clock3 } from 'lucide-react'
import { actionLabel, relativeTime, type Approval, type AuditEvent, type EventKind } from '../core'
import { EVENT_LABEL, dayTime, shortHost } from '../format'

type ActionsProps = { approvals: Approval[]; actions: AuditEvent[] }

const STATUS_META: Record<Approval['status'], { label: string; icon: typeof Clock3 }> = {
  pending: { label: '等待确认', icon: Clock3 },
  approved: { label: '已批准', icon: CircleCheck },
  rejected: { label: '已拒绝', icon: CircleSlash },
  failed: { label: '执行失败', icon: CircleAlert },
}

export function ActionsView({ approvals, actions }: ActionsProps) {
  const [filter, setFilter] = useState<'all' | Approval['status']>('all')
  const visible = filter === 'all' ? approvals : approvals.filter(item => item.status === filter)
  const pending = approvals.filter(item => item.status === 'pending').length

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>行动记录</h1>
          <p>每一次动到你设备或网络的操作都会留下痕迹，待确认的请求会一直等在这里。</p>
        </div>
        <em className={`count${pending ? ' strong' : ''}`}>{pending} 项待确认</em>
      </header>

      <div className="segmented filter">
        {(['all', 'pending', 'approved', 'rejected', 'failed'] as const).map(key => (
          <button key={key} className={filter === key ? 'active' : ''} type="button" onClick={() => setFilter(key)}>
            {key === 'all' ? `全部 ${approvals.length}` : STATUS_META[key].label}
          </button>
        ))}
      </div>

      <div className="action-list">
        {visible.length === 0 ? <p className="empty-hint">暂无匹配的行动记录。</p> : null}
        {visible.map(item => {
          const meta = STATUS_META[item.status]
          const Icon = meta.icon
          return (
            <article key={item.id} className={`action-row ${item.status}`}>
              <span className={`action-status ${item.status}`}><Icon size={15} /></span>
              <div className="action-body">
                <strong>{actionLabel(item.type)}</strong>
                <span className="action-target" title={item.target}>{item.type === 'open_url' || item.type === 'fetch_url' ? shortHost(item.target) : item.target}</span>
                <p>{item.reason}</p>
                {item.result ? <p className="action-result">结果：{item.result}</p> : null}
              </div>
              <div className="action-meta">
                <em>{meta.label}</em>
                <small>{relativeTime(item.createdAt)}</small>
              </div>
            </article>
          )
        })}
      </div>

      <section className="sub-block">
        <h2>最近的行为事件</h2>
        <ul className="event-line">
          {actions.slice(-8).reverse().map(event => (
            <li key={event.id}>
              <span className="event-kind">{EVENT_LABEL[event.kind]}</span>
              <span className="event-title">{event.title}</span>
              <small>{relativeTime(event.createdAt)}</small>
            </li>
          ))}
          {actions.length === 0 ? <li className="empty-hint">还没有行为事件。</li> : null}
        </ul>
      </section>
    </div>
  )
}

type AuditProps = { audit: AuditEvent[] }

export function AuditView({ audit }: AuditProps) {
  const [kind, setKind] = useState<'all' | EventKind>('all')
  const kinds = useMemo(() => {
    const seen: EventKind[] = []
    for (const event of audit) if (!seen.includes(event.kind)) seen.push(event.kind)
    return seen
  }, [audit])

  const visible = kind === 'all' ? audit : audit.filter(item => item.kind === kind)

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>审计记录</h1>
          <p>工作台中的每一步都按时间留痕，用于复盘与追溯，密钥等敏感信息不会写入这里。</p>
        </div>
        <em className="count">{audit.length} 条记录</em>
      </header>

      <div className="chip-row">
        <button className={`chip${kind === 'all' ? ' active' : ''}`} type="button" onClick={() => setKind('all')}>全部</button>
        {kinds.map(item => (
          <button key={item} className={`chip${kind === item ? ' active' : ''}`} type="button" onClick={() => setKind(item)}>{EVENT_LABEL[item]}</button>
        ))}
      </div>

      <ol className="timeline">
        {[...visible].reverse().map(event => (
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
        {visible.length === 0 ? <li className="empty-hint">还没有记录。</li> : null}
      </ol>
    </div>
  )
}
