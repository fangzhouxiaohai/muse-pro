import { describe, expect, it } from 'vitest'
import { approveAction, createInitialState, rejectAction, proposeAction, recordEvent, type WorkspaceState } from './core'

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
