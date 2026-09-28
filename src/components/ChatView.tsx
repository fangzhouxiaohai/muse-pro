import { useEffect, useRef } from 'react'
import { ArrowUp, CircleCheck, CircleDashed, FileText, Loader, Square, X, Paperclip } from 'lucide-react'
import type { Session, StepState } from '../core'
import { STEP_LABEL, clockTime } from '../format'
import heroImage from '../assets/workspace-hero.jpg'

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
  empty: boolean
}

const SUGGESTIONS = [
  '帮我把这周要推进的事情拆成可执行的任务',
  '阅读这份资料，提炼出三个关键结论',
  '根据我的目标，给出下周一整天的安排',
  '把这个结果整理成一份文件保存到本地',
]

function StepIcon({ state }: { state: StepState }) {
  if (state === 'running') return <Loader size={13} className="spin" />
  if (state === 'done') return <CircleCheck size={13} />
  if (state === 'failed') return <X size={13} />
  return <CircleDashed size={13} />
}

export default function ChatView({ session, thinking, draft, attachment, onDraft, onSend, onStop, onPickFile, onClearAttachment, onRemoveFileAttachment, empty }: Props) {
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
            <img className="welcome-art" src={heroImage} alt="Muse Pro 工作台视觉" />
            <h1>今天想推进什么</h1>
            <p>把想法、资料和目标放在这里，工作台会记住上下文；涉及你设备与网络的操作，会先请你确认。</p>
            <div className="suggestion-grid">
              {SUGGESTIONS.map(text => (
                <button key={text} className="suggestion" type="button" onClick={() => onDraft(text)}>{text}</button>
              ))}
            </div>
          </section>
        ) : null}

        <div className="message-stream">
          {session.messages.map(message => (
            <article key={message.id} className={`message ${message.role}`}>
              <header className="message-head">
                <span className="message-role">{message.role === 'user' ? '你' : message.role === 'assistant' ? 'Muse Pro' : '系统'}</span>
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
                <span className="message-role">Muse Pro</span>
                <span className="message-time">正在生成</span>
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
            placeholder="描述你要推进的事，Enter 发送，Shift 加 Enter 换行"
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
        <p className="composer-hint">打开网页、读取或写入本机文件的操作，会先出现在上方的审批条中等待你确认。</p>
      </div>
    </div>
  )
}
