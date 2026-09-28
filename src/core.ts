export type WorkspaceView = 'chat' | 'tasks' | 'goals' | 'files' | 'actions' | 'audit'
export type View = WorkspaceView
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

export type Item = { id: string; title: string; note: string; done: boolean; createdAt: string }
export type Attachment = { name: string; content: string }
export type Message = {
  id: string
  role: MessageRole
  content: string
  createdAt: string
  attachment?: string
  steps?: Step[]
}

export type FileKind = 'text' | 'markdown' | 'json' | 'csv' | 'code' | 'html'
export type WorkspaceFile = {
  id: string
  name: string
  path: string
  kind: FileKind
  size: number
  content: string
  origin: '已选择' | '模型写入'
  createdAt: string
}

export type EventKind =
  | 'task_created' | 'task_updated' | 'task_removed'
  | 'goal_created' | 'goal_updated' | 'goal_removed'
  | 'file_added' | 'file_removed'
  | 'url_opened' | 'url_fetched' | 'file_read' | 'file_written' | 'action_failed'
  | 'approval_requested' | 'approval_approved' | 'approval_rejected' | 'approval_failed'
  | 'message_sent' | 'response_received' | 'session_created' | 'session_removed'

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
  sessions: Session[]
  activeSessionId: string
  tasks: Item[]
  goals: Item[]
  files: WorkspaceFile[]
  approvals: Approval[]
  actions: AuditEvent[]
  audit: AuditEvent[]
}

const ACTIONABLE_KINDS: EventKind[] = [
  'task_created', 'task_updated', 'task_removed',
  'goal_created', 'goal_updated', 'goal_removed',
  'file_added', 'file_removed',
  'url_opened', 'url_fetched', 'file_read', 'file_written', 'action_failed',
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
  return { sessions: [session], activeSessionId: session.id, tasks: [], goals: [], files: [], approvals: [], actions: [], audit: [] }
}

export function activeSession(state: WorkspaceState): Session {
  return state.sessions.find(item => item.id === state.activeSessionId) ?? state.sessions[0]
}

export function recordEvent(state: WorkspaceState, kind: EventKind, title: string, detail: string, sessionId = state.activeSessionId): WorkspaceState {
  const event = makeEvent(kind, title, detail, sessionId)
  return { ...state, audit: [...state.audit, event], actions: ACTIONABLE_KINDS.includes(kind) ? [...state.actions, event] : state.actions }
}

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
  const kind: EventKind = role === 'user' ? 'message_sent' : role === 'assistant' ? 'response_received' : 'file_written'
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

export function proposeAction(state: WorkspaceState, request: ActionRequest): WorkspaceState {
  const approval: Approval = { ...request, id: uid(), status: 'pending', createdAt: new Date().toISOString(), sessionId: state.activeSessionId }
  const next = { ...state, approvals: [approval, ...state.approvals] }
  return recordEvent(next, 'approval_requested', '等待审批', `${actionLabel(request.type)}：${request.target}`)
}

export function actionLabel(type: ActionKind): string {
  return type === 'open_url' ? '打开外部网页' : type === 'fetch_url' ? '读取网页内容' : type === 'read_file' ? '读取本地文件' : '写入本地文件'
}

const findPending = (state: WorkspaceState, id: string) => state.approvals.find(item => item.id === id && item.status === 'pending')

export function approveAction(state: WorkspaceState, id: string): WorkspaceState {
  const approval = findPending(state, id)
  if (!approval) return state
  return recordEvent({ ...state, approvals: state.approvals.map(item => item.id === id ? { ...item, status: 'approved', resolvedAt: new Date().toISOString() } : item) }, 'approval_approved', '已批准操作', `${actionLabel(approval.type)}：${approval.target}`, approval.sessionId)
}

export function rejectAction(state: WorkspaceState, id: string): WorkspaceState {
  const approval = findPending(state, id)
  if (!approval) return state
  return recordEvent({ ...state, approvals: state.approvals.map(item => item.id === id ? { ...item, status: 'rejected', resolvedAt: new Date().toISOString() } : item) }, 'approval_rejected', '已拒绝操作', `${actionLabel(approval.type)}：${approval.target}`, approval.sessionId)
}

export function failAction(state: WorkspaceState, id: string, reason: string): WorkspaceState {
  const approval = state.approvals.find(item => item.id === id)
  if (!approval) return state
  return recordEvent({ ...state, approvals: state.approvals.map(item => item.id === id ? { ...item, status: 'failed', resolvedAt: new Date().toISOString(), result: reason } : item) }, 'approval_failed', '操作失败', `${actionLabel(approval.type)}：${approval.target} - ${reason}`, approval.sessionId)
}

export function finishAction(state: WorkspaceState, id: string, kind: EventKind, title: string, detail: string): WorkspaceState {
  const approval = state.approvals.find(item => item.id === id)
  if (!approval) return state
  return recordEvent({ ...state, approvals: state.approvals.map(item => item.id === id ? { ...item, result: detail } : item) }, kind, title, detail, approval.sessionId)
}

export function createItem(state: WorkspaceState, collection: 'tasks' | 'goals', title: string): WorkspaceState {
  const item: Item = { id: uid(), title: title.trim(), note: '', done: false, createdAt: new Date().toISOString() }
  if (!item.title) return state
  const next = { ...state, [collection]: [...state[collection], item] }
  return recordEvent(next, collection === 'tasks' ? 'task_created' : 'goal_created', collection === 'tasks' ? '创建任务' : '创建目标', item.title)
}

export function toggleItem(state: WorkspaceState, collection: 'tasks' | 'goals', id: string): WorkspaceState {
  const item = state[collection].find(value => value.id === id)
  if (!item) return state
  const next = { ...state, [collection]: state[collection].map(value => value.id === id ? { ...value, done: !value.done } : value) }
  return recordEvent(next, collection === 'tasks' ? 'task_updated' : 'goal_updated', item.done ? '重新开始' : '标记完成', item.title)
}

export function updateItem(state: WorkspaceState, collection: 'tasks' | 'goals', id: string, note: string): WorkspaceState {
  const item = state[collection].find(value => value.id === id)
  if (!item) return state
  const next = { ...state, [collection]: state[collection].map(value => value.id === id ? { ...value, note } : value) }
  return recordEvent(next, collection === 'tasks' ? 'task_updated' : 'goal_updated', '更新备注', item.title)
}

export function removeItem(state: WorkspaceState, collection: 'tasks' | 'goals', id: string): WorkspaceState {
  const item = state[collection].find(value => value.id === id)
  if (!item) return state
  const next = { ...state, [collection]: state[collection].filter(value => value.id !== id) }
  return recordEvent(next, collection === 'tasks' ? 'task_removed' : 'goal_removed', collection === 'tasks' ? '删除任务' : '删除目标', item.title)
}

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
  return recordEvent({ ...state, files }, 'file_added', existing ? '更新文件' : '加入文件', `${file.path}（${formatSize(file.size)}）`)
}

export function removeFile(state: WorkspaceState, id: string): WorkspaceState {
  const file = state.files.find(item => item.id === id)
  if (!file) return state
  return recordEvent({ ...state, files: state.files.filter(item => item.id !== id) }, 'file_removed', '移除文件', file.path)
}

export function formatSize(size: number): string {
  return size < 1024 ? `${size} 字节` : `${(size / 1024).toFixed(1)} KB`
}

export function relativeTime(value: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(value).getTime())
  const minute = 60_000
  if (diff < minute) return '刚刚'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} 小时前`
  if (diff < 7 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))} 天前`
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(value))
}

export function lineDiff(before: string, after: string): { added: number; removed: number } {
  const a = before.split('\n')
  const b = after.split('\n')
  const remaining = new Map<string, number>()
  for (const line of b) remaining.set(line, (remaining.get(line) ?? 0) + 1)
  let removed = 0
  for (const line of a) {
    const count = remaining.get(line) ?? 0
    if (count > 0) remaining.set(line, count - 1)
    else removed += 1
  }
  let added = 0
  for (const count of remaining.values()) added += count
  return { added, removed }
}

export type ModelSettings = { endpoint: string; model: string; apiKey: string }

export type ApprovalDraft =
  | { type: 'open_url'; target: string; reason: string }
  | { type: 'fetch_url'; target: string; reason: string }
  | { type: 'read_file'; target: string; reason: string }
  | { type: 'write_file'; target: string; reason: string; content: string }

export function approvalFrom(state: WorkspaceState, request: ApprovalDraft): WorkspaceState {
  return proposeAction(state, request)
}

export function isApprovalPending(state: WorkspaceState, id: string): boolean {
  return state.approvals.some(item => item.id === id && item.status === 'pending')
}

export function activeApprovals(state: WorkspaceState): Approval[] {
  return state.approvals.filter(item => item.sessionId === state.activeSessionId && item.status === 'pending')
}

export function describeWorkspace(state: WorkspaceState): string {
  const done = state.tasks.filter(item => item.done).length
  return `${state.tasks.length} 项任务（已完成 ${done}）、${state.goals.length} 项目标、${state.files.length} 份资料`
}

export function fileContext(file: WorkspaceFile, limit = 6000): string {
  const body = file.content.length > limit ? `${file.content.slice(0, limit)}\n（内容已截断）` : file.content
  return `文件：${file.name}\n路径：${file.path}\n---\n${body}`
}