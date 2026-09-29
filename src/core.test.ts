import { describe, expect, it } from 'vitest'
import {
  acceptSuggestion,
  activeSession,
  addFile,
  addSuggestion,
  appendMessage,
  approveAction,
  attachPlan,
  createGoal,
  createInitialState,
  createTask,
  dismissSuggestion,
  exportState,
  findGoalByTitle,
  forgetMemory,
  goalProgress,
  importState,
  migrateState,
  proposeAction,
  rejectAction,
  removeGoal,
  saveMemory,
  searchWorkspace,
  setBriefing,
  setPermission,
  shouldAutoApprove,
  startSession,
  toggleMemoryPin,
  updateMessage,
  memoryContext,
} from './core'

describe('操作审批与审计', () => {
  it('待审批操作不会直接变成已执行', () => {
    const initial = createInitialState()
    const next = proposeAction(initial, { type: 'open_url', target: 'https://example.com', reason: '查阅资料' })
    expect(next.approvals[0].status).toBe('pending')
    expect(next.audit.at(-1)?.kind).toBe('approval_requested')
  })

  it('批准和拒绝分别留下可追溯的记录', () => {
    const proposed = proposeAction(createInitialState(), { type: 'open_url', target: 'https://example.com', reason: '查阅资料' })
    const id = proposed.approvals[0].id
    const approved = approveAction(proposed, id)
    expect(approved.approvals[0].status).toBe('approved')
    expect(approved.audit.at(-1)?.kind).toBe('approval_approved')
    const rejected = rejectAction(proposed, id)
    expect(rejected.approvals[0].status).toBe('rejected')
  })

  it('未知审批编号不会改变状态', () => {
    const state = createInitialState()
    expect(approveAction(state, 'missing')).toBe(state)
  })
})

describe('会话与消息', () => {
  it('切换会话后仍能更新原会话里的消息', () => {
    const first = appendMessage(createInitialState(), 'user', '第一段对话')
    const firstMessageId = activeSession(first).messages[0].id
    const second = startSession(first)
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

describe('目标与计划', () => {
  it('为目标生成计划并记录审计', () => {
    let state = createGoal(createInitialState(), '三个月内跑完半程马拉松', '提升体能')
    const goal = state.goals[0]
    state = attachPlan(state, goal.id, [
      { title: '第 1-2 周：建立每周三次慢跑习惯', detail: '每次 3 公里' },
      { title: '第 8 周完成 15 公里长距离', detail: '' },
    ], '从零基础开始循序渐进')
    expect(state.goals[0].plan).toHaveLength(2)
    expect(state.goals[0].why).toBe('从零基础开始循序渐进')
    expect(state.audit.at(-1)?.kind).toBe('goal_plan_created')
  })

  it('任务挂在目标上并参与进度统计，删除目标后任务解除关联', () => {
    let state = createGoal(createInitialState(), '整理家庭相册')
    const goalId = state.goals[0].id
    state = createTask(state, '挑选 50 张照片', goalId)
    state = createTask(state, '按年份分类', goalId)
    state = createTask(state, '与目标无关的任务')
    expect(goalProgress(state, goalId)).toEqual({ total: 2, done: 0 })
    const withoutGoal = removeGoal(state, goalId)
    expect(withoutGoal.goals).toHaveLength(0)
    expect(withoutGoal.tasks).toHaveLength(3)
    expect(withoutGoal.tasks.every(task => task.goalId === null)).toBe(true)
  })

  it('按标题模糊匹配目标', () => {
    const state = createGoal(createInitialState(), '三个月内跑完半程马拉松')
    expect(findGoalByTitle(state, '半程马拉松')?.id).toBe(state.goals[0].id)
    expect(findGoalByTitle(state, '不存在')).toBeUndefined()
  })
})

describe('记忆', () => {
  it('保存记忆去重并留痕', () => {
    let state = saveMemory(createInitialState(), '用户偏好简洁的中文回复')
    state = saveMemory(state, '用户偏好简洁的中文回复')
    expect(state.memories).toHaveLength(1)
    expect(state.audit.at(-1)?.kind).toBe('memory_saved')
  })

  it('遗忘记忆会把条目从列表移除', () => {
    let state = saveMemory(createInitialState(), '每周三晚上有羽毛球局')
    const id = state.memories[0].id
    state = forgetMemory(state, id)
    expect(state.memories).toHaveLength(0)
    expect(state.audit.at(-1)?.kind).toBe('memory_forgotten')
  })

  it('置顶记忆优先注入上下文', () => {
    let state = saveMemory(createInitialState(), '较早的普通记忆')
    state = saveMemory(state, '最新的普通记忆')
    state = toggleMemoryPin(state, state.memories[1].id)
    const context = memoryContext(state)
    expect(context[0]).toBe('较早的普通记忆')
  })
})

describe('想法与简报', () => {
  it('采纳想法会自动创建任务', () => {
    let state = addSuggestion(createInitialState(), { title: '把周报模板沉淀成文档', detail: '每周五前自动整理要点' })
    const suggestion = state.suggestions[0]
    state = acceptSuggestion(state, suggestion.id)
    expect(state.suggestions[0].status).toBe('accepted')
    expect(state.tasks.map(task => task.title)).toContain('把周报模板沉淀成文档')
    expect(state.audit.at(-1)?.kind).toBe('suggestion_accepted')
  })

  it('搁置想法直接移除', () => {
    let state = addSuggestion(createInitialState(), { title: '试试新的读书方法', detail: '' })
    state = dismissSuggestion(state, state.suggestions[0].id)
    expect(state.suggestions).toHaveLength(0)
  })

  it('生成简报后可再次覆盖', () => {
    let state = setBriefing(createInitialState(), '今日重点：推进相册整理', ['效率工具'])
    state = setBriefing(state, '今日重点：半马训练', ['效率工具'])
    expect(state.briefing?.content).toBe('今日重点：半马训练')
    expect(state.briefing?.interests).toEqual(['效率工具'])
  })
})

describe('权限', () => {
  it('默认全部需要询问，可按类目切换为自动批准', () => {
    let state = createInitialState()
    expect(shouldAutoApprove(state, 'fetch_url')).toBe(false)
    state = setPermission(state, 'fetch_url', 'auto')
    expect(shouldAutoApprove(state, 'fetch_url')).toBe(true)
    expect(shouldAutoApprove(state, 'write_file')).toBe(false)
    expect(state.audit.at(-1)?.detail).toContain('自动批准')
  })
})

describe('资料', () => {
  it('模型生成的文档以工件事件入库', () => {
    const state = addFile(createInitialState(), { name: '训练计划.md', content: '# 半马 12 周计划', origin: '模型生成' })
    expect(state.files[0].kind).toBe('markdown')
    expect(state.audit.at(-1)?.kind).toBe('artifact_created')
  })
})

describe('迁移、导入与导出', () => {
  it('从旧版 Muse Pro 数据迁移：任务、目标、会话、资料全部保留', () => {
    const legacy = {
      state: {
        sessions: [{ id: 's1', title: '旧的对话', createdAt: '2026-09-01T00:00:00.000Z', messages: [{ id: 'm1', role: 'user', content: '你好', createdAt: '2026-09-01T00:00:00.000Z' }] }],
        activeSessionId: 's1',
        tasks: [{ id: 't1', title: '旧任务', note: '', done: false, createdAt: '2026-09-01T00:00:00.000Z' }],
        goals: [{ id: 'g1', title: '旧目标', note: '为什么', done: false, createdAt: '2026-09-01T00:00:00.000Z' }],
        files: [],
        approvals: [],
        actions: [],
        audit: [],
      },
      theme: 'light',
    }
    const migrated = migrateState(legacy)
    expect(migrated.version).toBe(2)
    expect(migrated.sessions[0].title).toBe('旧的对话')
    expect(migrated.tasks[0].title).toBe('旧任务')
    expect(migrated.goals[0]).toMatchObject({ title: '旧目标', why: '为什么', status: 'active', plan: [] })
    expect(migrated.settings.endpoint).toContain('deepseek')
  })

  it('能读取 Lyra 导出的完整备份', () => {
    let state = createGoal(createInitialState(), '备份数据')
    state = createTask(state, '导出 JSON')
    const json = exportState(state)
    const restored = importState(json)
    expect(restored.goals[0].title).toBe('备份数据')
    expect(restored.tasks[0].title).toBe('导出 JSON')
  })

  it('无法识别的数据会抛出异常', () => {
    expect(() => migrateState({ foo: 'bar' })).toThrow()
    expect(() => migrateState('not-json-shape')).toThrow()
  })
})

describe('全局搜索', () => {
  it('跨会话、目标、记忆与资料返回命中', () => {
    let state = appendMessage(createInitialState(), 'user', '我想研究一下光合作用的机制')
    state = createGoal(state, '整理光合作用资料')
    state = saveMemory(state, '用户对光合作用特别感兴趣')
    state = addFile(state, { name: 'notes.md', content: '光合作用发生在叶绿体', origin: '已选择' })
    const hits = searchWorkspace(state, '光合作用')
    const views = hits.map(hit => hit.view)
    expect(views).toContain('chat')
    expect(views).toContain('goals')
    expect(views).toContain('memory')
    expect(views).toContain('files')
  })

  it('空关键词与未命中返回空数组', () => {
    const state = createInitialState()
    expect(searchWorkspace(state, '')).toEqual([])
    expect(searchWorkspace(state, '量子纠缠')).toEqual([])
  })
})
