import { useState } from 'react'
import { Flag, Loader, Pause, Play, Plus, RotateCcw, Sparkles, Target, Trash2, Trophy, MessagesSquare, CircleCheck } from 'lucide-react'
import type { GoalStatus, WorkspaceState } from '../core'
import { goalProgress } from '../core'
import { GOAL_STATUS_LABEL, relativeTime } from '../format'

type Props = {
  state: WorkspaceState
  busy: boolean
  planningId: string | null
  onCreateGoal: (title: string, why: string) => void
  onPlan: (goalId: string) => void
  onStatus: (goalId: string, status: GoalStatus) => void
  onRemoveGoal: (goalId: string) => void
  onToggleTask: (taskId: string) => void
  onAddTask: (goalId: string | null, title: string) => void
  onRemoveTask: (taskId: string) => void
  onChatAbout: (goalId: string) => void
}

const STATUS_ORDER: GoalStatus[] = ['active', 'paused', 'achieved']

export default function GoalsView({ state, busy, planningId, onCreateGoal, onPlan, onStatus, onRemoveGoal, onToggleTask, onAddTask, onRemoveTask, onChatAbout }: Props) {
  const [title, setTitle] = useState('')
  const [why, setWhy] = useState('')
  const [taskDraft, setTaskDraft] = useState<Record<string, string>>({})

  const submitGoal = () => {
    if (!title.trim()) return
    onCreateGoal(title, why)
    setTitle('')
    setWhy('')
  }

  const orphanTasks = state.tasks.filter(task => !task.goalId)

  const taskRow = (taskId: string) => {
    const task = state.tasks.find(item => item.id === taskId)
    if (!task) return null
    return (
      <li key={task.id} className={`task-row${task.done ? ' done' : ''}`}>
        <button className="check-btn" type="button" onClick={() => onToggleTask(task.id)} title={task.done ? '重新开始' : '标记完成'}>
          {task.done ? <CircleCheck size={13} /> : null}
        </button>
        <span>{task.title}</span>
        <button className="icon-btn" type="button" onClick={() => onRemoveTask(task.id)} title="删除任务"><Trash2 size={13} /></button>
      </li>
    )
  }

  const addTaskRow = (goalId: string | null) => (
    <li className="task-add">
      <input
        value={taskDraft[goalId ?? 'none'] ?? ''}
        placeholder="添加一个任务，回车确认"
        onChange={event => setTaskDraft(current => ({ ...current, [goalId ?? 'none']: event.target.value }))}
        onKeyDown={event => {
          if (event.key !== 'Enter') return
          const value = (taskDraft[goalId ?? 'none'] ?? '').trim()
          if (!value) return
          onAddTask(goalId, value)
          setTaskDraft(current => ({ ...current, [goalId ?? 'none']: '' }))
        }}
      />
    </li>
  )

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>目标</h1>
          <p>把想达成的事变成持续推进的计划：天琴会为每个目标拆解步骤、跟进任务、沉淀进展。</p>
        </div>
      </header>

      <div className="compose-bar goal-compose">
        <input value={title} onChange={event => setTitle(event.target.value)} placeholder="新目标，例如：三个月内跑完半程马拉松" />
        <input className="why-input" value={why} onChange={event => setWhy(event.target.value)} placeholder="为什么重要（可选）" />
        <button className="primary-btn" type="button" onClick={submitGoal} disabled={!title.trim()}><Flag size={14} /><span>创建目标</span></button>
      </div>

      {state.goals.length === 0 ? (
        <div className="empty-state">
          <Target size={28} />
          <h2>还没有目标</h2>
          <p>在上方写下第一个目标，或直接对天琴说「我想达成一件事」。</p>
        </div>
      ) : null}

      <div className="goal-list">
        {STATUS_ORDER.flatMap(status => state.goals.filter(goal => goal.status === status)).map(goal => {
          const progress = goalProgress(state, goal.id)
          const percent = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
          const related = state.tasks.filter(task => task.goalId === goal.id)
          const planning = planningId === goal.id
          return (
            <article key={goal.id} className={`goal-card status-${goal.status}`}>
              <header className="goal-head">
                <div className="goal-titles">
                  <h2>{goal.title}</h2>
                  {goal.why ? <p className="goal-why">{goal.why}</p> : null}
                </div>
                <span className={`goal-pill ${goal.status}`}>{GOAL_STATUS_LABEL[goal.status]}</span>
              </header>

              {related.length ? (
                <div className="goal-progress">
                  <div className="progress-track"><span className="progress-fill" style={{ width: `${percent}%` }} /></div>
                  <em>{progress.done}/{progress.total} 项任务 · {percent}%</em>
                </div>
              ) : null}

              {goal.plan.length ? (
                <section className="goal-plan">
                  <header className="plan-head">
                    <strong>行动计划</strong>
                    <span>
                      {goal.planUpdatedAt ? <em>更新于 {relativeTime(goal.planUpdatedAt)}</em> : null}
                      <button className="link-btn" type="button" onClick={() => onPlan(goal.id)} disabled={busy || planning}>
                        {planning ? <Loader size={12} className="spin" /> : <RotateCcw size={12} />}
                        <span>重新生成</span>
                      </button>
                    </span>
                  </header>
                  <ol className="plan-steps">
                    {goal.plan.map((step, index) => (
                      <li key={`${goal.id}-${index}`} className="plan-step">
                        <span className="plan-num">{index + 1}</span>
                        <div>
                          <strong>{step.title}</strong>
                          {step.detail ? <p>{step.detail}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : goal.status === 'active' ? (
                <button className="ghost-btn plan-btn" type="button" onClick={() => onPlan(goal.id)} disabled={busy || planning}>
                  {planning ? <Loader size={14} className="spin" /> : <Sparkles size={14} />}
                  <span>让天琴制定计划</span>
                </button>
              ) : null}

              <ul className="task-list">
                {related.map(task => taskRow(task.id))}
                {addTaskRow(goal.id)}
              </ul>

              <footer className="goal-actions">
                <button className="ghost-btn small" type="button" onClick={() => onChatAbout(goal.id)}><MessagesSquare size={13} /><span>围绕目标对话</span></button>
                {goal.status === 'active' ? (
                  <button className="ghost-btn small" type="button" onClick={() => onStatus(goal.id, 'paused')}><Pause size={13} /><span>暂停</span></button>
                ) : goal.status === 'paused' ? (
                  <button className="ghost-btn small" type="button" onClick={() => onStatus(goal.id, 'active')}><Play size={13} /><span>恢复推进</span></button>
                ) : null}
                {goal.status !== 'achieved' ? (
                  <button className="ghost-btn small" type="button" onClick={() => onStatus(goal.id, 'achieved')}><Trophy size={13} /><span>达成</span></button>
                ) : (
                  <button className="ghost-btn small" type="button" onClick={() => onStatus(goal.id, 'active')}><RotateCcw size={13} /><span>重新开启</span></button>
                )}
                <button className="ghost-btn small danger" type="button" onClick={() => onRemoveGoal(goal.id)}><Trash2 size={13} /><span>删除</span></button>
              </footer>
            </article>
          )
        })}
      </div>

      <section className="orphan-block">
        <header className="block-head">
          <span><Plus size={13} /> 未关联目标的任务</span>
        </header>
        {orphanTasks.length === 0 && !taskDraft.none ? (
          <p className="empty-hint">暂时没有独立任务。快速记录的小事会出现在这里。</p>
        ) : (
          <ul className="task-list standalone">
            {orphanTasks.map(task => taskRow(task.id))}
            {addTaskRow(null)}
          </ul>
        )}
      </section>
    </div>
  )
}
