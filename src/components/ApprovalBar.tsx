import { useState } from 'react'
import { Download, FileDown, FileUp, Upload, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react'
import { actionLabel, type Approval } from '../core'
import { shortHost } from '../format'

type Props = {
  approvals: Approval[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

const ICONS = {
  open_url: Upload,
  fetch_url: Download,
  read_file: FileUp,
  write_file: FileDown,
} as const

export default function ApprovalBar({ approvals, onApprove, onReject }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)
  if (approvals.length === 0) return null

  return (
    <section className="approval-bar" aria-label="待审批操作">
      {approvals.map(approval => {
        const Icon = ICONS[approval.type]
        const isOpen = expanded === approval.id
        return (
          <article key={approval.id} className="approval-card">
            <div className="approval-head">
              <span className="approval-icon"><Icon size={16} /></span>
              <div className="approval-title">
                <strong>{actionLabel(approval.type)}</strong>
                <span className="approval-target" title={approval.target}>
                  {approval.type === 'read_file' || approval.type === 'write_file' ? approval.target : shortHost(approval.target)}
                </span>
              </div>
              <span className="approval-flag"><ShieldAlert size={13} />待确认</span>
            </div>

            <p className="approval-reason">{approval.reason}</p>

            {approval.type === 'write_file' ? (
              <div className="approval-preview">
                <button className="link-btn" type="button" onClick={() => setExpanded(isOpen ? null : approval.id)}>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{isOpen ? '收起写入内容' : `查看写入内容（${approval.content.length} 字）`}</span>
                </button>
                {isOpen ? <pre className="preview-body">{approval.content.slice(0, 4000)}</pre> : null}
              </div>
            ) : null}

            <div className="approval-actions">
              <button className="ghost-btn" type="button" onClick={() => onReject(approval.id)}>拒绝</button>
              <button className="primary-btn" type="button" onClick={() => onApprove(approval.id)}>批准并执行</button>
            </div>
          </article>
        )
      })}
    </section>
  )
}
