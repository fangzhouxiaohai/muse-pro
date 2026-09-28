import { describe, expect, it } from 'vitest'
import {
  activeSession,
  appendMessage,
  approveAction,
  createInitialState,
  rejectAction,
  proposeAction,
  recordEvent,
  startSession,
  updateMessage,
  type WorkspaceState,
} from './core'

describe('操作审批与审计', () => {
  it('待审批操作不会直接变成已执行', () => {
    const initial = createInitialState()
    const next = proposeAction(initial, { type: 'open_url', target: 'https://example.com', reason: '查阅资料' })
    expect(next.approvals[0].status).toBe('pending')
    expect(next.audit.at(-1)?.kind).toBe('approval_requested')
    expect(next.actions).toHaveLength(0)
  })

  it('批准和拒绝分别留下可追溯的记录', () => {
    const proposed = proposeAction(createInitialState(), { type: 'open_url', target: 'https://example.com', reason: '查阅资料' })
    const id = proposed.approvals[0].id
    const approved = approveAction(proposed, id)
    expect(approved.approvals[0].status).toBe('approved')
    expect(approved.audit.at(-1)?.kind).toBe('approval_approved')
    expect(approved.actions).toHaveLength(0)
    const rejected = rejectAction(proposed, id)
    expect(rejected.approvals[0].status).toBe('rejected')
    expect(rejected.audit.at(-1)?.kind).toBe('approval_rejected')
  })

  it('未知审批编号不会改变状态', () => {
    const state = createInitialState()
    expect(approveAction(state, 'missing')).toBe(state)
  })

  it('行为事件保留详情而不记录密钥', () => {
    const state: WorkspaceState = createInitialState()
    const next = recordEvent(state, 'task_created', '创建任务', '整理资料')
    expect(next.actions).toHaveLength(1)
    expect(next.audit.at(-1)?.detail).toBe('整理资料')
  })
})

describe('会话与消息', () => {
  it('切换会话后仍能更新原会话里的消息', () => {
    const first = appendMessage(createInitialState(), 'user', '第一段对话')
    const firstMessageId = activeSession(first).messages[0].id
    const second = startSession(first)
    expect(activeSession(second).id).not.toBe(activeSession(first).id)

    const updated = updateMessage(second, firstMessageId, { content: '已经被更新' })
    const origin = updated.sessions.find(item => item.id === activeSession(first).id)
    expect(origin?.messages[0].content).toBe('已经被更新')
    expect(activeSession(updated).messages).toHaveLength(0)
  })

  it('新建会话时首条用户消息会成为标题', () => {
    const state = appendMessage(createInitialState(), 'user', '帮我整理下周的行程安排并记录成任务')
    expect(activeSession(state).title).toBe('帮我整理下周的行程安排并记录成任务'.slice(0, 24))
  })
})
