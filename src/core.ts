export type View = 'chat' | 'goals' | 'ideas' | 'memory' | 'files' | 'audit'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'failed'
export type ActionKind = 'open_url' | 'fetch_url' | 'read_file' | 'write_file'
export type MessageRole = 'user' | 'assistant' | 'system'

export type StepState = 'running' | 'done' | 'pending' | 'failed'
export type Step = { id: string; label: string; state: StepState }

export type ActionRequest =
  | { type: 'open_url'; target: string; reason: string }
  | { type: 'fetch_url'; target: string; reason: string }
  | { type: 'read_file'; target: string; reason: string }
  | { type: 'write_file'; target: string; reason: string; content: string }

export type Approval = ActionRequest & {
  id: string
  status: ApprovalStatus
  createdAt: string
  resolvedAt?: string
  result?: string
  sessionId: string
}

export type Message = {
  id: string
  role: MessageRole
  content: string
  createdAt: string
  attachment?: string
  steps?: Step[]
}

export type Task = { id: string; goalId: string | null; title: string; note: string; done: boolean; createdAt: string }
export type PlanStep = { title: string; detail: string }
export type GoalStatus = 'active' | 'paused' | 'achieved'
export type Goal = {
  id: string
  title: string
  why: string
  status: GoalStatus
  plan: PlanStep[]
  planUpdatedAt?: string
  createdAt: string
}

export type MemorySource = '对话沉淀' | '手动添加'
export type Memory = { id: string; content: string; pinned: boolean; source: MemorySource; createdAt: string }

export type SuggestionStatus = 'new' | 'accepted' | 'dismissed'
export type Suggestion = { id: string; title: string; detail: string; status: SuggestionStatus; createdAt: string }

export type Briefing = { content: string; generatedAt: string; interests: string[] }

export type FileKind = 'text' | 'markdown' | 'json' | 'csv' | 'code' | 'html'
export type WorkspaceFile = {
  id: string
  name: string
  path: string
  kind: FileKind
  size: number
  content: string
  origin: '已选择' | '模型写入' | '模型生成'
  createdAt: string
}

export type PermissionMode = 'ask' | 'auto'
export type Permissions = Record<ActionKind, PermissionMode>
export type AgentSettings = { endpoint: string; model: string; permissions: Permissions; interests: string[] }

export type EventKind =
  | 'task_created' | 'task_updated' | 'task_removed'
  | 'goal_created' | 'goal_updated' | 'goal_removed' | 'goal_plan_created'
  | 'memory_saved' | 'memory_forgotten'
  | 'suggestion_created' | 'suggestion_accepted' | 'suggestion_dismissed'
  | 'briefing_generated' | 'artifact_created'
  | 'file_added' | 'file_removed'
  | 'url_opened' | 'url_fetched' | 'file_read' | 'file_written' | 'action_failed'
  | 'approval_requested' | 'approval_approved' | 'approval_rejected' | 'approval_failed'
  | 'message_sent' | 'response_received' | 'session_created' | 'session_removed'
  | 'settings_updated' | 'data_imported' | 'data_exported'

export type AuditEvent = {
  id: string
  kind: EventKind
  title: string
  detail: string
  createdAt: string
  sessionId: string
}

export type Session = { id: string; title: string; createdAt: string; messages: Message[] }

export type WorkspaceState = {
  version: 2
  sessions: Session[]
  activeSessionId: string
  goals: Goal[]
  tasks: Task[]
  memories: Memory[]
  suggestions: Suggestion[]
  briefing: Briefing | null
  files: WorkspaceFile[]
  approvals: Approval[]
  audit: AuditEvent[]
  settings: AgentSettings
}

export const ACTIONABLE_KINDS: EventKind[] = [
  'task_created', 'task_updated', 'task_removed',
  'goal_created', 'goal_updated', 'goal_removed', 'goal_plan_created',
  'memory_saved', 'memory_forgotten',
  'suggestion_accepted', 'briefing_generated', 'artifact_created',
  'file_added', 'file_removed',
  'url_opened', 'url_fetched', 'file_read', 'file_written', 'action_failed',
]

export const DEFAULT_PERMISSIONS: Permissions = { open_url: 'ask', fetch_url: 'ask', read_file: 'ask', write_file: 'ask' }

export const DEFAULT_SETTINGS: AgentSettings = {
  endpoint: 'https://api.deepseek.com/v1/chat/completions',
  model: 'deepseek-chat',
  permissions: DEFAULT_PERMISSIONS,
  interests: [],
}

export const MODEL_PRESETS: { label: string; endpoint: string; model: string }[] = [
  { label: '深度求索', endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
  { label: '月之暗面', endpoint: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
  { label: '本地 Ollama', endpoint: 'http://localhost:11434/v1/chat/completions', model: 'qwen2.5:7b' },
]

const uid = () => crypto.randomUUID()

function makeEvent(kind: EventKind, title: string, detail: string, sessionId: string): AuditEvent {
  return { id: uid(), kind, title, detail, createdAt: new Date().toISOString(), sessionId }
}

export function createSession(title = '新的对话'): Session {
  return { id: uid(), title, createdAt: new Date().toISOString(), messages: [] }
}

export function createInitialState(): WorkspaceState {
  const session = createSession()
  return {
    version: 2,
    sessions: [session],
    activeSessionId: session.id,
    goals: [],
    tasks: [],
    memories: [],
    suggestions: [],
    briefing: null,
    files: [],
    approvals: [],
    audit: [],
    settings: { ...DEFAULT_SETTINGS, permissions: { ...DEFAULT_PERMISSIONS }, interests: [] },
  }
}

function recordEvent(state: WorkspaceState, kind: EventKind, title: string, detail: string, sessionId?: string): WorkspaceState {
  const event = makeEvent(kind, title, detail, sessionId ?? state.activeSessionId)
  return { ...state, audit: [...state.audit, event].slice(-400) }
}

export function activeSession(state: WorkspaceState): Session {
  return state.sessions.find(item => item.id === state.activeSessionId) ?? state.sessions[0]
}

/* ---------------- 会话与消息 ---------------- */

export function startSession(state: WorkspaceState): WorkspaceState {
  const session = createSession()
  return recordEvent({ ...state, sessions: [...state.sessions, session], activeSessionId: session.id }, 'session_created', '新建对话', session.title, session.id)
}

export function selectSession(state: WorkspaceState, id: string): WorkspaceState {
  if (!state.sessions.some(item => item.id === id)) return state
  return { ...state, activeSessionId: id }
}

export function removeSession(state: WorkspaceState, id: string): WorkspaceState {
  if (state.sessions.length <= 1 || !state.sessions.some(item => item.id === id)) return state
  const sessions = state.sessions.filter(item => item.id !== id)
  const active = state.activeSessionId === id ? sessions[sessions.length - 1].id : state.activeSessionId
  return recordEvent({ ...state, sessions, activeSessionId: active, approvals: state.approvals.filter(item => item.sessionId !== id) }, 'session_removed', '移除对话', '对话及其待审批请求已移除', active)
}

function mapSession(state: WorkspaceState, id: string, fn: (session: Session) => Session): WorkspaceState {
  return { ...state, sessions: state.sessions.map(item => item.id === id ? fn(item) : item) }
}

export function appendMessage(state: WorkspaceState, role: MessageRole, content: string, attachment?: string, steps?: Step[]): WorkspaceState {
  const message: Message = { id: uid(), role, content, createdAt: new Date().toISOString(), attachment, steps }
  const sessionId = state.activeSessionId
  const next = mapSession(state, sessionId, session => {
    const titled = session.title === '新的对话' && role === 'user' ? { ...session, title: content.trim().slice(0, 24) || session.title } : session
    return { ...titled, messages: [...titled.messages, message] }
  })
  const kind: EventKind = role === 'user' ? 'message_sent' : role === 'assistant' ? 'response_received' : 'action_failed'
  const title = role === 'user' ? '发送消息' : role === 'assistant' ? '收到回复' : '操作结果'
  return recordEvent(next, kind, title, attachment ? `包含文件上下文：${attachment}` : content.slice(0, 60), sessionId)
}

export function updateMessage(state: WorkspaceState, id: string, patch: Partial<Message>): WorkspaceState {
  return {
    ...state,
    sessions: state.sessions.map(session => session.messages.some(item => item.id === id)
      ? { ...session, messages: session.messages.map(item => item.id === id ? { ...item, ...patch } : item) }
      : session),
  }
}

/* ---------------- 审批（Sentinel 门） ---------------- */

export type ApprovalDraft =
  | { type: 'open_url'; target: string; reason: string }
  | { type: 'fetch_url'; target: string; reason: string }
  | { type: 'read_file'; target: string; reason: string }
  | { type: 'write_file'; target: string; reason: string; content: string }

export function actionLabel(type: ActionKind): string {
  return type === 'open_url' ? '打开外部网页' : type === 'fetch_url' ? '读取网页内容' : type === 'read_file' ? '读取本地文件' : '写入本地文件'
}

export function proposeAction(state: WorkspaceState, request: ApprovalDraft, id = uid()): WorkspaceState {
  const approval: Approval = { ...request, id, status: 'pending', createdAt: new Date().toISOString(), sessionId: state.activeSessionId }
  const next = { ...state, approvals: [approval, ...state.approvals] }
  return recordEvent(next, 'approval_requested', '等待审批', `${actionLabel(request.type)}：${request.target}`)
}

export function shouldAutoApprove(state: WorkspaceState, kind: ActionKind): boolean {
  return state.settings.permissions[kind] === 'auto'
}

const findApproval = (state: WorkspaceState, id: string) => state.approvals.find(item => item.id === id)

export function approveAction(state: WorkspaceState, id: string): WorkspaceState {
  const approval = findApproval(state, id)
  if (!approval || approval.status !== 'pending') return state
  return recordEvent({ ...state, approvals: state.approvals.map(item => item.id === id ? { ...item, status: 'approved', resolvedAt: new Date().toISOString() } : item) }, 'approval_approved', '已批准操作', `${actionLabel(approval.type)}：${approval.target}`, approval.sessionId)
}

export function rejectAction(state: WorkspaceState, id: string): WorkspaceState {
  const approval = findApproval(state, id)
  if (!approval || approval.status !== 'pending') return state
  return recordEvent({ ...state, approvals: state.approvals.map(item => item.id === id ? { ...item, status: 'rejected', resolvedAt: new Date().toISOString() } : item) }, 'approval_rejected', '已拒绝操作', `${actionLabel(approval.type)}：${approval.target}`, approval.sessionId)
}

export function failAction(state: WorkspaceState, id: string, reason: string): WorkspaceState {
  const approval = findApproval(state, id)
  if (!approval) return state
  return recordEvent({ ...state, approvals: state.approvals.map(item => item.id === id ? { ...item, status: 'failed', resolvedAt: new Date().toISOString(), result: reason } : item) }, 'approval_failed', '操作失败', `${actionLabel(approval.type)}：${approval.target} - ${reason}`, approval.sessionId)
}

export function finishAction(state: WorkspaceState, id: string, kind: EventKind, title: string, detail: string): WorkspaceState {
  const approval = findApproval(state, id)
  if (!approval) return state
  return recordEvent({ ...state, approvals: state.approvals.map(item => item.id === id ? { ...item, result: detail } : item) }, kind, title, detail, approval.sessionId)
}

export function activeApprovals(state: WorkspaceState): Approval[] {
  return state.approvals.filter(item => item.sessionId === state.activeSessionId && item.status === 'pending')
}

export function pendingApprovals(state: WorkspaceState): Approval[] {
  return state.approvals.filter(item => item.status === 'pending')
}

/* ---------------- 目标与任务 ---------------- */

export function createGoal(state: WorkspaceState, title: string, why = ''): WorkspaceState {
  const trimmed = title.trim()
  if (!trimmed) return state
  const goal: Goal = { id: uid(), title: trimmed, why: why.trim(), status: 'active', plan: [], createdAt: new Date().toISOString() }
  return recordEvent({ ...state, goals: [...state.goals, goal] }, 'goal_created', '创建目标', trimmed)
}

export type GoalPatch = Partial<Pick<Goal, 'title' | 'why' | 'status'>>

export function updateGoal(state: WorkspaceState, id: string, patch: GoalPatch): WorkspaceState {
  const goal = state.goals.find(item => item.id === id)
  if (!goal) return state
  const goals = state.goals.map(item => item.id === id ? { ...item, ...patch } : item)
  const title = patch.status === 'achieved' ? '目标达成' : patch.status === 'paused' ? '目标暂停' : patch.status === 'active' ? '目标恢复推进' : '更新目标'
  return recordEvent({ ...state, goals }, 'goal_updated', title, goal.title)
}

export function removeGoal(state: WorkspaceState, id: string): WorkspaceState {
  const goal = state.goals.find(item => item.id === id)
  if (!goal) return state
  return recordEvent({
    ...state,
    goals: state.goals.filter(item => item.id !== id),
    tasks: state.tasks.map(task => task.goalId === id ? { ...task, goalId: null } : task),
  }, 'goal_removed', '删除目标', goal.title)
}

export function attachPlan(state: WorkspaceState, goalId: string, plan: PlanStep[], note = ''): WorkspaceState {
  const goal = state.goals.find(item => item.id === goalId)
  if (!goal || plan.length === 0) return state
  const goals = state.goals.map(item => item.id === goalId
    ? { ...item, plan, planUpdatedAt: new Date().toISOString(), why: note || item.why }
    : item)
  return recordEvent({ ...state, goals }, 'goal_plan_created', '生成计划', `${goal.title}（${plan.length} 步）`)
}

export function createTask(state: WorkspaceState, title: string, goalId: string | null = null): WorkspaceState {
  const trimmed = title.trim()
  if (!trimmed) return state
  const task: Task = { id: uid(), goalId, title: trimmed, note: '', done: false, createdAt: new Date().toISOString() }
  return recordEvent({ ...state, tasks: [...state.tasks, task] }, 'task_created', '创建任务', trimmed)
}

export function toggleTask(state: WorkspaceState, id: string): WorkspaceState {
  const task = state.tasks.find(item => item.id === id)
  if (!task) return state
  return recordEvent({ ...state, tasks: state.tasks.map(item => item.id === id ? { ...item, done: !item.done } : item) }, 'task_updated', task.done ? '重新开始' : '标记完成', task.title)
}

export function updateTask(state: WorkspaceState, id: string, note: string): WorkspaceState {
  const task = state.tasks.find(item => item.id === id)
  if (!task) return state
  return recordEvent({ ...state, tasks: state.tasks.map(item => item.id === id ? { ...item, note } : item) }, 'task_updated', '更新备注', task.title)
}

export function removeTask(state: WorkspaceState, id: string): WorkspaceState {
  const task = state.tasks.find(item => item.id === id)
  if (!task) return state
  return recordEvent({ ...state, tasks: state.tasks.filter(item => item.id !== id) }, 'task_removed', '删除任务', task.title)
}

export function goalProgress(state: WorkspaceState, goalId: string): { total: number; done: number } {
  const related = state.tasks.filter(item => item.goalId === goalId)
  return { total: related.length, done: related.filter(item => item.done).length }
}

export function findGoalByTitle(state: WorkspaceState, title: string): Goal | undefined {
  const needle = title.trim()
  if (!needle) return undefined
  return state.goals.find(item => item.title === needle)
    ?? state.goals.find(item => item.title.includes(needle) || needle.includes(item.title))
}

/* ---------------- 记忆 ---------------- */

export function saveMemory(state: WorkspaceState, content: string, source: MemorySource = '对话沉淀'): WorkspaceState {
  const trimmed = content.trim()
  if (!trimmed) return state
  if (state.memories.some(item => item.content === trimmed)) return state
  const memory: Memory = { id: uid(), content: trimmed, pinned: false, source, createdAt: new Date().toISOString() }
  return recordEvent({ ...state, memories: [memory, ...state.memories].slice(0, 120) }, 'memory_saved', source === '手动添加' ? '手动记忆' : '自动记忆', trimmed)
}

export function forgetMemory(state: WorkspaceState, id: string): WorkspaceState {
  const memory = state.memories.find(item => item.id === id)
  if (!memory) return state
  return recordEvent({ ...state, memories: state.memories.filter(item => item.id !== id) }, 'memory_forgotten', '遗忘记忆', memory.content)
}

export function toggleMemoryPin(state: WorkspaceState, id: string): WorkspaceState {
  const memory = state.memories.find(item => item.id === id)
  if (!memory) return state
  return recordEvent({ ...state, memories: state.memories.map(item => item.id === id ? { ...item, pinned: !item.pinned } : item) }, 'memory_saved', memory.pinned ? '取消置顶' : '置顶记忆', memory.content)
}

/** 注入模型提示的记忆：置顶优先，其次最近 */
export function memoryContext(state: WorkspaceState, limit = 12): string[] {
  const pinned = state.memories.filter(item => item.pinned).map(item => item.content)
  const recent = state.memories.filter(item => !item.pinned).slice(0, limit - pinned.length).map(item => item.content)
  return [...pinned, ...recent]
}

/* ---------------- 想法与简报（主动建议） ---------------- */

export function addSuggestion(state: WorkspaceState, input: { title: string; detail: string }): WorkspaceState {
  const title = input.title.trim()
  if (!title) return state
  const suggestion: Suggestion = { id: uid(), title, detail: input.detail.trim(), status: 'new', createdAt: new Date().toISOString() }
  const kept = [...state.suggestions.filter(item => item.status !== 'dismissed'), suggestion].slice(-40)
  return recordEvent({ ...state, suggestions: kept }, 'suggestion_created', '产生想法', title)
}

export function acceptSuggestion(state: WorkspaceState, id: string): WorkspaceState {
  const suggestion = state.suggestions.find(item => item.id === id)
  if (!suggestion || suggestion.status !== 'new') return state
  const withTask = createTask({ ...state, suggestions: state.suggestions.map(item => item.id === id ? { ...item, status: 'accepted' as const } : item) }, suggestion.title)
  return recordEvent(withTask, 'suggestion_accepted', '采纳想法', suggestion.title)
}

export function dismissSuggestion(state: WorkspaceState, id: string): WorkspaceState {
  const suggestion = state.suggestions.find(item => item.id === id)
  if (!suggestion || suggestion.status !== 'new') return state
  return recordEvent({ ...state, suggestions: state.suggestions.filter(item => item.id !== id) }, 'suggestion_dismissed', '搁置想法', suggestion.title)
}

export function setBriefing(state: WorkspaceState, content: string, interests: string[]): WorkspaceState {
  if (!content.trim()) return state
  const briefing: Briefing = { content, generatedAt: new Date().toISOString(), interests: [...interests] }
  return recordEvent({ ...state, briefing }, 'briefing_generated', '生成简报', content.slice(0, 60))
}

/* ---------------- 资料 ---------------- */

const KIND_BY_EXT: Record<string, FileKind> = {
  md: 'markdown', markdown: 'markdown', json: 'json', csv: 'csv', html: 'html', htm: 'html',
  ts: 'code', tsx: 'code', js: 'code', jsx: 'code', css: 'code', py: 'code', rs: 'code', go: 'code', java: 'code', vue: 'code', sql: 'code', sh: 'code', yml: 'code', yaml: 'code', toml: 'code',
}

export function fileKindOf(name: string): FileKind {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return KIND_BY_EXT[ext] ?? 'text'
}

export function addFile(state: WorkspaceState, input: { name: string; path?: string; content: string; origin: WorkspaceFile['origin'] }): WorkspaceState {
  const name = input.name
  const key = input.path ?? name
  const existing = state.files.find(item => item.path === key)
  const file: WorkspaceFile = {
    id: existing?.id ?? uid(),
    name,
    path: key,
    kind: fileKindOf(name),
    size: new Blob([input.content]).size,
    content: input.content,
    origin: input.origin,
    createdAt: new Date().toISOString(),
  }
  const files = existing ? state.files.map(item => item.id === existing.id ? file : item) : [...state.files, file]
  const kind: EventKind = input.origin === '模型生成' ? 'artifact_created' : 'file_added'
  return recordEvent({ ...state, files }, kind, existing ? '更新资料' : '加入资料', `${file.path}（${formatSize(file.size)}）`)
}

export function removeFile(state: WorkspaceState, id: string): WorkspaceState {
  const file = state.files.find(item => item.id === id)
  if (!file) return state
  return recordEvent({ ...state, files: state.files.filter(item => item.id !== id) }, 'file_removed', '移除资料', file.path)
}

export function formatSize(size: number): string {
  return size < 1024 ? `${size} 字节` : `${(size / 1024).toFixed(1)} KB`
}

/* ---------------- 设置 ---------------- */

export function updateSettings(state: WorkspaceState, patch: Partial<Omit<AgentSettings, 'permissions'>>): WorkspaceState {
  const parts = [patch.endpoint && '接口地址', patch.model && '模型名称', patch.interests && '兴趣关键词'].filter(Boolean) as string[]
  return recordEvent({ ...state, settings: { ...state.settings, ...patch } }, 'settings_updated', '更新设置', parts.length ? parts.join('、') : '设置未变化')
}

export function setPermission(state: WorkspaceState, kind: ActionKind, mode: PermissionMode): WorkspaceState {
  const permissions = { ...state.settings.permissions, [kind]: mode }
  return recordEvent({ ...state, settings: { ...state.settings, permissions } }, 'settings_updated', '调整权限', `${actionLabel(kind)}改为${mode === 'auto' ? '自动批准' : '每次询问'}`)
}

/* ---------------- 展示辅助 ---------------- */

export function relativeTime(value: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(value).getTime())
  const minute = 60_000
  if (diff < minute) return '刚刚'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} 小时前`
  if (diff < 7 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))} 天前`
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(value))
}

export function describeWorkspace(state: WorkspaceState): string {
  const openTasks = state.tasks.filter(item => !item.done).length
  const parts = [
    state.goals.length ? `${state.goals.length} 项目标` : '',
    openTasks ? `${openTasks} 项待办` : '',
    state.memories.length ? `${state.memories.length} 条记忆` : '',
    state.files.length ? `${state.files.length} 份资料` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : '从一句话或一个目标开始'
}

export function fileContext(file: WorkspaceFile, limit = 6000): string {
  const body = file.content.length > limit ? `${file.content.slice(0, limit)}\n（内容已截断）` : file.content
  return `文件：${file.name}\n路径：${file.path}\n---\n${body}`
}

/* ---------------- 全局搜索 ---------------- */

export type SearchHit = {
  view: View
  id: string
  title: string
  snippet: string
  sessionId?: string
  groupId?: string
}

function snippetAround(text: string, query: string, span = 22): string {
  const index = text.indexOf(query)
  if (index < 0) return text.slice(0, span * 2)
  const start = Math.max(0, index - span)
  const end = Math.min(text.length, index + query.length + span)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

export function searchWorkspace(state: WorkspaceState, rawQuery: string): SearchHit[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return []
  const hits: SearchHit[] = []
  const push = (hit: SearchHit) => {
    if (hits.length < 40) hits.push(hit)
  }

  for (const session of state.sessions) {
    if (session.title.toLowerCase().includes(query)) {
      push({ view: 'chat', id: session.id, title: session.title, snippet: `${session.messages.length} 条消息`, sessionId: session.id })
    }
    for (const message of session.messages) {
      if (message.content.toLowerCase().includes(query)) {
        push({ view: 'chat', id: message.id, title: session.title, snippet: snippetAround(message.content, rawQuery.trim()), sessionId: session.id })
      }
    }
  }
  for (const goal of state.goals) {
    const haystack = [goal.title, goal.why, ...goal.plan.map(step => step.title)].join('\n')
    if (haystack.toLowerCase().includes(query)) {
      push({ view: 'goals', id: goal.id, title: goal.title, snippet: snippetAround(goal.why || goal.title, rawQuery.trim()), groupId: goal.id })
    }
  }
  for (const task of state.tasks) {
    if (`${task.title}\n${task.note}`.toLowerCase().includes(query)) {
      push({ view: 'goals', id: task.id, title: task.title, snippet: snippetAround(task.note || task.title, rawQuery.trim()), groupId: task.goalId ?? undefined })
    }
  }
  for (const memory of state.memories) {
    if (memory.content.toLowerCase().includes(query)) {
      push({ view: 'memory', id: memory.id, title: '记忆', snippet: snippetAround(memory.content, rawQuery.trim()) })
    }
  }
  for (const file of state.files) {
    if (`${file.name}\n${file.content}`.toLowerCase().includes(query)) {
      push({ view: 'files', id: file.id, title: file.name, snippet: snippetAround(file.content || file.name, rawQuery.trim()) })
    }
  }
  for (const event of [...state.audit].reverse()) {
    if (`${event.title}\n${event.detail}`.toLowerCase().includes(query)) {
      push({ view: 'audit', id: event.id, title: event.title, snippet: snippetAround(event.detail, rawQuery.trim()) })
    }
  }
  return hits
}

/* ---------------- 迁移、导入与导出 ---------------- */

type LegacyItem = { id: string; title: string; note: string; done: boolean; createdAt: string }

function normalize(raw: Partial<WorkspaceState> & Record<string, unknown>): WorkspaceState {
  const base = createInitialState()
  const sessions = Array.isArray(raw.sessions) && raw.sessions.length ? raw.sessions as Session[] : base.sessions
  const settingsRaw = (raw.settings ?? {}) as Partial<AgentSettings>
  return {
    version: 2,
    sessions,
    activeSessionId: typeof raw.activeSessionId === 'string' && sessions.some(item => item.id === raw.activeSessionId) ? raw.activeSessionId : sessions[0].id,
    goals: Array.isArray(raw.goals) ? raw.goals as Goal[] : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks as Task[] : [],
    memories: Array.isArray(raw.memories) ? raw.memories as Memory[] : [],
    suggestions: Array.isArray(raw.suggestions) ? raw.suggestions as Suggestion[] : [],
    briefing: (raw.briefing ?? null) as Briefing | null,
    files: Array.isArray(raw.files) ? raw.files as WorkspaceFile[] : [],
    approvals: Array.isArray(raw.approvals) ? raw.approvals as Approval[] : [],
    audit: Array.isArray(raw.audit) ? raw.audit as AuditEvent[] : [],
    settings: {
      endpoint: typeof settingsRaw.endpoint === 'string' && settingsRaw.endpoint ? settingsRaw.endpoint : DEFAULT_SETTINGS.endpoint,
      model: typeof settingsRaw.model === 'string' && settingsRaw.model ? settingsRaw.model : DEFAULT_SETTINGS.model,
      permissions: { ...DEFAULT_PERMISSIONS, ...(settingsRaw.permissions ?? {}) },
      interests: Array.isArray(settingsRaw.interests) ? settingsRaw.interests.filter(item => typeof item === 'string') : [],
    },
  }
}

/** 兼容旧版 Muse Pro（v0.1）工作台数据；无法识别的结构抛出异常 */
export function migrateState(raw: unknown): WorkspaceState {
  if (!raw || typeof raw !== 'object') throw new Error('数据格式不正确。')
  const record = raw as Record<string, unknown>
  const state = record.state && typeof record.state === 'object' ? record.state as Record<string, unknown> : record

  if (state.version === 2) return normalize(state as Partial<WorkspaceState>)

  if (Array.isArray(state.sessions) && Array.isArray(state.tasks) && Array.isArray(state.goals)) {
    const migrated = normalize(state as Partial<WorkspaceState>)
    const legacyTasks = state.tasks as LegacyItem[]
    const legacyGoals = state.goals as LegacyItem[]
    migrated.goals = legacyGoals.map(item => ({
      id: item.id, title: item.title, why: item.note, status: (item.done ? 'achieved' : 'active') as GoalStatus,
      plan: [], createdAt: item.createdAt,
    }))
    migrated.tasks = legacyTasks.map(item => ({
      id: item.id, goalId: null, title: item.title, note: item.note, done: item.done, createdAt: item.createdAt,
    }))
    migrated.memories = []
    migrated.suggestions = []
    migrated.briefing = null
    return migrated
  }
  throw new Error('无法识别的数据版本。')
}

export function exportState(state: WorkspaceState): string {
  return JSON.stringify({ app: 'lyra', kind: 'workspace', exportedAt: new Date().toISOString(), state }, null, 2)
}

export function importState(json: string): WorkspaceState {
  const parsed = JSON.parse(json) as Record<string, unknown>
  const state = migrateState(parsed)
  return recordEvent(state, 'data_imported', '导入数据', '已恢复备份的工作台数据', state.activeSessionId)
}

export function isApprovalPending(state: WorkspaceState, id: string): boolean {
  return state.approvals.some(item => item.id === id && item.status === 'pending')
}
