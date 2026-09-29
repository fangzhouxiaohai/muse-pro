import { useState } from 'react'
import { Lightbulb, Loader, Newspaper, RefreshCw, Sparkles, ThumbsDown, CircleCheck, MessageSquarePlus } from 'lucide-react'
import type { WorkspaceState } from '../core'
import { relativeTime } from '../format'

type Props = {
  state: WorkspaceState
  busy: boolean
  briefingBusy: boolean
  onGenerate: () => void
  onBriefing: () => void
  onAccept: (id: string) => void
  onDismiss: (id: string) => void
  onChat: (text: string) => void
}

const TEMPLATES = [
  '根据我的目标，制定这周的行动计划',
  '回顾我最近的进展，指出卡住的地方',
  '帮我调研一个主题，把要点整理成资料保存',
  '把今天完成的事情整理成一份日报文档',
  '记住我的工作习惯和偏好',
  '为一个新目标做拆解，给出第一步行动',
]

export default function IdeasView({ state, busy, briefingBusy, onGenerate, onBriefing, onAccept, onDismiss, onChat }: Props) {
  const [tab, setTab] = useState<'ideas' | 'templates'>('ideas')
  const suggestions = state.suggestions.filter(item => item.status !== 'dismissed')

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>想法</h1>
          <p>天琴会根据目标、任务与记忆，主动提出下一步建议；你也可以从模板开始一段新的推进。</p>
        </div>
      </header>

      <section className="briefing-card">
        <header className="briefing-head">
          <div>
            <strong><Newspaper size={15} /> 今日简报</strong>
            {state.briefing ? <em>生成于 {relativeTime(state.briefing.generatedAt)}</em> : <em>还没有简报</em>}
          </div>
          <button className="ghost-btn small" type="button" onClick={onBriefing} disabled={briefingBusy}>
            {briefingBusy ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />}
            <span>{state.briefing ? '刷新简报' : '生成简报'}</span>
          </button>
        </header>
        {state.briefing ? (
          <div className="briefing-body">{state.briefing.content}</div>
        ) : (
          <p className="empty-hint">生成一份简报，看看今天最值得推进的事。在设置中添加兴趣关键词，简报会结合它们。</p>
        )}
      </section>

      <div className="segmented filter">
        <button className={tab === 'ideas' ? 'active' : ''} type="button" onClick={() => setTab('ideas')}>想法 {suggestions.length > 0 ? `(${suggestions.length})` : ''}</button>
        <button className={tab === 'templates' ? 'active' : ''} type="button" onClick={() => setTab('templates')}>提示词模板</button>
      </div>

      {tab === 'ideas' ? (
        <>
          <div className="ideas-actions">
            <button className="primary-btn" type="button" onClick={onGenerate} disabled={busy}>
              {busy ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
              <span>{suggestions.length ? '再想一些' : '让天琴想想'}</span>
            </button>
          </div>
          {suggestions.length === 0 && !busy ? (
            <div className="empty-state">
              <Lightbulb size={28} />
              <h2>还没有想法</h2>
              <p>点击「让天琴想想」，它会结合你的目标、任务和记忆给出建议。</p>
            </div>
          ) : null}
          <div className="idea-list">
            {suggestions.map(suggestion => (
              <article key={suggestion.id} className={`idea-card ${suggestion.status}`}>
                <header>
                  <strong>{suggestion.title}</strong>
                  <em>{relativeTime(suggestion.createdAt)}</em>
                </header>
                {suggestion.detail ? <p>{suggestion.detail}</p> : null}
                <footer className="idea-actions">
                  {suggestion.status === 'new' ? (
                    <>
                      <button className="primary-btn small" type="button" onClick={() => onAccept(suggestion.id)}><CircleCheck size={13} /><span>采纳为任务</span></button>
                      <button className="ghost-btn small" type="button" onClick={() => onChat(`关于想法「${suggestion.title}」：${suggestion.detail || '请展开说说怎么推进'}`)}><MessageSquarePlus size={13} /><span>去聊聊</span></button>
                      <button className="ghost-btn small" type="button" onClick={() => onDismiss(suggestion.id)}><ThumbsDown size={13} /><span>忽略</span></button>
                    </>
                  ) : (
                    <span className="idea-done"><CircleCheck size={13} /> 已采纳为任务</span>
                  )}
                </footer>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="template-grid">
          {TEMPLATES.map(text => (
            <button key={text} className="template-card" type="button" onClick={() => onChat(text)}>
              <Sparkles size={14} />
              <span>{text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
