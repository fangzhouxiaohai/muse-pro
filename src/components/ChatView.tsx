import { useEffect, useRef } from 'react'
import { ArrowUp, CircleCheck, CircleDashed, FileText, Loader, Paperclip, Square, X } from 'lucide-react'
import LyraMark from './LyraMark'
import type { Session, StepState } from '../core'
import { STEP_LABEL, clockTime } from '../format'

type Props = {
  session: Session
  thinking: boolean
  draft: string
  attachment: { name: string; content: string } | null
  onDraft: (value: string) => void
  onSend: () => void
  onStop: () => void
  onPickFile: () => void
  onClearAttachment: () => void
  onRemoveFileAttachment: () => void
  onOpenGoals: () => void
  empty: boolean
}

const SUGGESTIONS = [
  '我想在三个月内跑完半程马拉松，帮我制定一份计划',
  '记住：我习惯早上写作，晚上复盘',
  '根据我的目标，给出今天最值得推进的三件事',
  '把这次讨论的结论整理成一份文档保存',
]

function StepIcon({ state }: { state: StepState }) {
  if (state === 'running') return <Loader size={13} className="spin" />
  if (state === 'done') return <CircleCheck size={13} />
  if (state === 'failed') return <X size={13} />
  return <CircleDashed size={13} />
}

export default function ChatView({ session, thinking, draft, attachment, onDraft, onSend, onStop, onPickFile, onClearAttachment, onRemoveFileAttachment, onOpenGoals, empty }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const node = scroller.current
    if (node) node.scrollTop = node.scrollHeight
  }, [session.messages, thinking])

  useEffect(() => {
    const node = textarea.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 180)}px`
  }, [draft])

  const handleKey = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!thinking) onSend()
    }
  }

  return (
    <div className="chat-view">
      <div className="chat-scroll" ref={scroller}>
        {empty ? (
          <section className="welcome">
            <div className="welcome-sky" aria-hidden="true">
              <div className="welcome-mark"><LyraMark size={92} /></div>
            </div>
            <h1>把目标交给天琴</h1>
            <p>说出你想达成的事，天琴会制定计划、跟进任务、沉淀记忆；触及设备与网络的操作，都会先请你批准。</p>
            <div className="suggestion-grid">
              {SUGGESTIONS.map(text => (
                <button key={text} className="suggestion" type="button" onClick={() => onDraft(text)}>{text}</button>
              ))}
            </div>
            <button className="link-btn welcome-goal-link" type="button" onClick={onOpenGoals}>先看看目标页 →</button>
          </section>
        ) : null}

        <div className="message-stream">
          {session.messages.map(message => (
            <article key={message.id} className={`message ${message.role}`}>
              <header className="message-head">
                <span className="message-role">{message.role === 'user' ? '你' : message.role === 'assistant' ? '天琴' : '系统'}</span>
                <span className="message-time">{clockTime(message.createdAt)}</span>
              </header>
              {message.attachment ? (
                <span className="attachment-chip">
                  <FileText size={13} />
                  <span>{message.attachment}</span>
                  <button className="chip-remove" type="button" onClick={onRemoveFileAttachment} title="从工作台移除这份文件"><X size={12} /></button>
                </span>
              ) : null}
              {message.content ? <div className="message-body">{message.content}</div> : null}
              {message.steps?.length ? (
                <ul className="step-list">
                  {message.steps.map(step => (
                    <li key={step.id} className={`step ${step.state}`}>
                      <StepIcon state={step.state} />
                      <span>{step.label}</span>
                      <em>{STEP_LABEL[step.state]}</em>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}

          {thinking ? (
            <article className="message assistant">
              <header className="message-head">
                <span className="message-role">天琴</span>
                <span className="message-time">正在推进</span>
              </header>
              <div className="typing"><span /><span /><span /></div>
            </article>
          ) : null}
        </div>
      </div>

      <div className="composer">
        {attachment ? (
          <div className="attachment-preview">
            <FileText size={14} />
            <span className="attachment-name">{attachment.name}</span>
            <span className="attachment-size">{attachment.content.length} 字</span>
            <button className="icon-btn" type="button" onClick={onClearAttachment} title="取消这次附件"><X size={14} /></button>
          </div>
        ) : null}
        <div className="composer-row">
          <button className="icon-btn" type="button" onClick={onPickFile} title="添加本地文件作为上下文"><Paperclip size={17} /></button>
          <textarea
            ref={textarea}
            value={draft}
            rows={1}
            placeholder="告诉天琴你想推进什么，Enter 发送，Shift 加 Enter 换行"
            onChange={event => onDraft(event.target.value)}
            onKeyDown={handleKey}
          />
          {thinking ? (
            <button className="stop-btn" type="button" onClick={onStop} title="停止生成"><Square size={15} /></button>
          ) : (
            <button className="send-btn" type="button" onClick={onSend} disabled={!draft.trim()} title="发送">
              <ArrowUp size={17} />
            </button>
          )}
        </div>
        <p className="composer-hint">打开网页、读取或写入本机文件会先请你批准；计划与记忆会同步到「目标」和「记忆」页。</p>
      </div>
    </div>
  )
}
