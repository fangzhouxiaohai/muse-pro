import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { PanelLeft, Search, Sparkles } from 'lucide-react'
import {
  acceptSuggestion,
  activeApprovals,
  activeSession,
  addFile,
  addSuggestion,
  appendMessage,
  approveAction,
  attachPlan,
  createGoal,
  createInitialState,
  createTask,
  describeWorkspace,
  dismissSuggestion,
  exportState,
  failAction,
  findGoalByTitle,
  finishAction,
  forgetMemory,
  goalProgress,
  importState,
  memoryContext,
  migrateState,
  proposeAction,
  rejectAction,
  removeFile,
  removeGoal,
  removeSession,
  removeTask,
  saveMemory,
  selectSession,
  setBriefing,
  setPermission,
  shouldAutoApprove,
  startSession,
  toggleMemoryPin,
  toggleTask,
  updateGoal,
  updateMessage,
  updateSettings,
  type ActionKind,
  type AgentSettings,
  type ApprovalDraft,
  type GoalStatus,
  type Message,
  type PlanStep,
  type SearchHit,
  type Step,
  type StepState,
  type View,
  type WorkspaceFile,
  type WorkspaceState,
} from './core'
import { buildSystemPrompt, fetchPage, toolLabel, type ModelSettings, type RunContext, type ToolCall, type WireMessage } from './ai'
import { runAgent } from './agent'
import { generateBriefing, generatePlan, generateSuggestions } from './proactive'
import { MAX_TEXT_FILE, hasNativeFileAccess, platformLabel, readTextPath, writeTextPath } from './platform'
import { GOAL_STATUS_LABEL } from './format'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import GoalsView from './components/GoalsView'
import IdeasView from './components/IdeasView'
import MemoryView from './components/MemoryView'
import FilesView from './components/FilesView'
import AuditView from './components/AuditView'
import ApprovalBar from './components/ApprovalBar'
import SettingsDialog from './components/SettingsDialog'
import SearchDialog from './components/SearchDialog'

const WORKSPACE_KEY = 'lyra-workspace-v1'
const LEGACY_KEY = 'muse-pro-workspace-v2'
const THEME_KEY = 'lyra-theme-v1'
const SESSION_LIMIT = 24
const MESSAGE_LIMIT = 80
const FILE_LIMIT = 6

type Persisted = { state: WorkspaceState; theme: 'light' | 'dark' }

function restore(): Persisted | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted
      if (parsed?.state) return { state: migrateState(parsed.state), theme: parsed.theme === 'dark' ? 'dark' : 'light' }
    }
  } catch { /* 继续尝试旧数据 */ }
  try {
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy) {
      const parsed = JSON.parse(legacy) as { state?: unknown; theme?: string }
      if (parsed?.state) return { state: migrateState(parsed.state), theme: parsed.theme === 'dark' ? 'dark' : 'light' }
    }
  } catch { /* 无法恢复时从空白开始 */ }
  return null
}

function slimState(input: WorkspaceState): WorkspaceState {
  return {
    ...input,
    sessions: input.sessions.slice(-SESSION_LIMIT).map(session => ({ ...session, messages: session.messages.slice(-MESSAGE_LIMIT) })),
    files: input.files.map((file, index, all) => ({ ...file, content: index >= all.length - FILE_LIMIT ? file.content.slice(0, 24_000) : '' })),
    audit: input.audit.slice(-400),
  }
}

function persist(state: WorkspaceState, theme: 'light' | 'dark') {
  try {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ state: slimState(state), theme }))
    localStorage.setItem(THEME_KEY, theme)
  } catch { /* 存储空间不足时保持内存中的状态不变 */ }
}

function findMessage(state: WorkspaceState, id: string): Message | undefined {
  for (const session of state.sessions) {
    const found = session.messages.find(message => message.id === id)
    if (found) return found
  }
  return undefined
}

const VIEW_TITLE: Record<Exclude<View, 'chat'>, string> = {
  goals: '目标',
  ideas: '想法',
  memory: '记忆',
  files: '资料库',
  audit: '审计',
}

const PERMISSION_KINDS: ActionKind[] = ['open_url', 'fetch_url', 'read_file', 'write_file']

export default function App() {
  const boot = useMemo(restore, [])
  const [state, setState] = useState<WorkspaceState>(() => boot?.state ?? createInitialState())
  const [theme, setTheme] = useState<'light' | 'dark'>(() => boot?.theme ?? 'light')
  const [view, setView] = useState<View>('chat')
  const [apiKey, setApiKey] = useState('')
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [planningId, setPlanningId] = useState<string | null>(null)
  const [ideasBusy, setIdeasBusy] = useState(false)
  const [briefingBusy, setBriefingBusy] = useState(false)
  const [fileBusy, setFileBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const ideasAbortRef = useRef<AbortController | null>(null)
  const briefingAbortRef = useRef<AbortController | null>(null)
  const planAbortRef = useRef<AbortController | null>(null)
  const waitersRef = useRef(new Map<string, (result: string | null) => void>())

  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { persist(state, theme) }, [state, theme])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(open => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const session = activeSession(state)
  const pending = activeApprovals(state)
  const native = hasNativeFileAccess()

  const notify = useCallback((message: string) => setToast(message), [])

  const model = useMemo<ModelSettings>(() => ({
    endpoint: state.settings.endpoint,
    model: state.settings.model,
    apiKey,
  }), [apiKey, state.settings.endpoint, state.settings.model])

  const runContext = useCallback((): RunContext => {
    const current = stateRef.current
    return {
      goals: current.goals.map(goal => {
        const progress = goalProgress(current, goal.id)
        return { title: goal.title, status: GOAL_STATUS_LABEL[goal.status], planSteps: goal.plan.length, openTasks: progress.total - progress.done }
      }),
      tasks: current.tasks.slice(0, 40).map(task => ({
        title: task.title,
        done: task.done,
        goal: task.goalId ? current.goals.find(item => item.id === task.goalId)?.title : undefined,
      })),
      memories: memoryContext(current),
      fileNames: current.files.map(item => item.name),
      interests: current.settings.interests,
      briefing: current.briefing?.content,
    }
  }, [])

  /* ---------- 步骤与消息辅助 ---------- */

  const addStep = useCallback((assistantId: string, label: string, stepState: StepState = 'running'): string => {
    const stepId = `step_${crypto.randomUUID().slice(0, 8)}`
    setState(current => updateMessage(current, assistantId, {
      steps: [...(findMessage(current, assistantId)?.steps ?? []), { id: stepId, label, state: stepState }],
    }))
    return stepId
  }, [])

  const setStep = useCallback((assistantId: string, stepId: string, label: string, stepState: StepState) => {
    setState(current => updateMessage(current, assistantId, {
      steps: (findMessage(current, assistantId)?.steps ?? []).map(step => step.id === stepId ? { ...step, label, state: stepState } : step),
    }))
  }, [])

  /* ---------- 外部操作执行 ---------- */

  const finishKind = (type: ActionKind) =>
    type === 'open_url' ? 'url_opened' as const
      : type === 'fetch_url' ? 'url_fetched' as const
        : type === 'read_file' ? 'file_read' as const
          : 'file_written' as const

  const executeRequest = useCallback(async (draft: ApprovalDraft): Promise<string> => {
    if (draft.type === 'open_url') {
      if (native) await openUrl(draft.target)
      else window.open(draft.target, '_blank', 'noopener,noreferrer')
      return `已在浏览器中打开 ${draft.target}`
    }
    if (draft.type === 'fetch_url') {
      const page = await fetchPage(draft.target)
      return `已读取《${page.title}》共 ${page.text.length} 字${page.truncated ? '（内容较长，已截断）' : ''}。正文如下：\n${page.text.slice(0, 6000)}`
    }
    if (draft.type === 'read_file') {
      const content = await readTextPath(draft.target)
      const name = draft.target.split(/[\\/]/).pop() ?? draft.target
      setState(current => addFile(current, { name, path: draft.target, content, origin: '已选择' }))
      return `已读取 ${name}（${content.length} 字）：\n${content.slice(0, 6000)}`
    }
    if (!native) {
      const local = stateRef.current.files.find(item => item.path === draft.target || item.name === draft.target)
      if (local) {
        setState(current => addFile(current, { name: local.name, path: local.path, content: draft.content, origin: '模型写入' }))
        return `已更新工作台内的 ${local.name}（${draft.content.length} 字）`
      }
      throw new Error('网页版不能写入本机文件；可以让天琴把内容保存为资料库文档，或在桌面版中执行。')
    }
    const destination = await writeTextPath(draft.target, draft.content)
    const name = destination.split(/[\\/]/).pop() ?? destination
    setState(current => addFile(current, { name, path: destination, content: draft.content, origin: '模型写入' }))
    return `已写入 ${name}（${draft.content.length} 字）`
  }, [native])

  const resolveApproval = useCallback(async (id: string, decision: 'approve' | 'reject') => {
    const approval = stateRef.current.approvals.find(item => item.id === id && item.status === 'pending')
    if (!approval) return
    if (decision === 'reject') {
      setState(current => rejectAction(current, id))
      waitersRef.current.get(id)?.(null)
      waitersRef.current.delete(id)
      notify('已拒绝这次操作。')
      return
    }
    setState(current => approveAction(current, id))
    try {
      const result = await executeRequest(approval)
      setState(current => finishAction(current, id, finishKind(approval.type), '操作已执行', result))
      waitersRef.current.get(id)?.(result)
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : '执行这个操作时出现了问题。'
      setState(current => failAction(current, id, reason))
      waitersRef.current.get(id)?.(`执行失败：${reason}`)
    } finally {
      waitersRef.current.delete(id)
    }
  }, [executeRequest, notify])

  /** 审批门：自动批准直接执行，否则等待用户在审批条上裁决 */
  const gate = useCallback(async (draft: ApprovalDraft, assistantId: string, label: string): Promise<string> => {
    if (shouldAutoApprove(stateRef.current, draft.type)) {
      const id = crypto.randomUUID()
      setState(current => approveAction(proposeAction(current, draft, id), id))
      const stepId = addStep(assistantId, `${label}：${draft.target}（自动批准）`)
      try {
        const result = await executeRequest(draft)
        setState(current => finishAction(current, id, finishKind(draft.type), '操作已执行', result))
        setStep(assistantId, stepId, `${label}：${draft.target}`, 'done')
        return result
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : '执行失败'
        setState(current => failAction(current, id, reason))
        setStep(assistantId, stepId, `${label}：执行失败`, 'failed')
        return `执行失败：${reason}`
      }
    }
    const id = crypto.randomUUID()
    setState(current => proposeAction(current, draft, id))
    const stepId = addStep(assistantId, `${label}：${draft.target}（等待确认）`, 'pending')
    const result = await new Promise<string | null>(resolve => { waitersRef.current.set(id, resolve) })
    if (result === null) {
      setStep(assistantId, stepId, `${label}：用户已拒绝`, 'failed')
      return '用户拒绝了这次操作。请接受这个结果，调整方案或向用户说明情况。'
    }
    setStep(assistantId, stepId, `${label}：${draft.target}`, 'done')
    return result
  }, [addStep, executeRequest, setStep])

  /* ---------- 工具执行 ---------- */

  const executeTool = useCallback(async (call: ToolCall, assistantId: string): Promise<string> => {
    let args: Record<string, unknown> = {}
    try {
      args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
    } catch {
      addStep(assistantId, `${toolLabel(call.name)}（参数不完整）`, 'failed')
      return '指令参数不是有效的 JSON，请重新调用。'
    }
    const stepId = addStep(assistantId, toolLabel(call.name))
    const done = (label: string) => setStep(assistantId, stepId, label, 'done')
    const fail = (label: string) => setStep(assistantId, stepId, label, 'failed')

    switch (call.name) {
      case 'create_task': {
        const title = String(args.title ?? '').trim()
        if (!title) { fail('记录任务：缺少标题'); return 'create_task 需要提供 title。' }
        const goal = args.goal_title ? findGoalByTitle(stateRef.current, String(args.goal_title)) : undefined
        setState(current => createTask(current, title, goal?.id ?? null))
        done(`记录任务：${title}${goal ? `（目标：${goal.title}）` : ''}`)
        return `已创建任务「${title}」${goal ? `，归属目标「${goal.title}」` : ''}`
      }
      case 'create_goal': {
        const title = String(args.title ?? '').trim()
        if (!title) { fail('记录目标：缺少标题'); return 'create_goal 需要提供 title。' }
        setState(current => createGoal(current, title, String(args.why ?? '')))
        done(`记录目标：${title}`)
        return `已创建目标「${title}」`
      }
      case 'propose_plan': {
        const goalTitle = String(args.goal_title ?? '').trim()
        const goal = findGoalByTitle(stateRef.current, goalTitle)
        if (!goal) { fail(`制定计划：未找到目标「${goalTitle}」`); return `没有找到目标「${goalTitle}」，可以先用 create_goal 创建。` }
        const steps: PlanStep[] = Array.isArray(args.steps)
          ? (args.steps as unknown[]).map(item => {
              const record = (item ?? {}) as Record<string, unknown>
              return { title: String(record.title ?? '').trim(), detail: String(record.detail ?? '') }
            }).filter(step => step.title)
          : []
        if (!steps.length) { fail(`制定计划：${goal.title}（步骤为空）`); return '计划步骤为空，请提供 3 到 6 步。' }
        setState(current => attachPlan(current, goal.id, steps, String(args.note ?? '')))
        done(`为目标「${goal.title}」制定 ${steps.length} 步计划`)
        return `已为目标「${goal.title}」生成 ${steps.length} 步计划`
      }
      case 'save_memory': {
        const content = String(args.content ?? '').trim()
        if (!content) { fail('沉淀记忆：缺少内容'); return 'save_memory 需要提供 content。' }
        const existed = stateRef.current.memories.some(item => item.content === content)
        setState(current => saveMemory(current, content))
        done(`沉淀记忆：${content}`)
        return existed ? '这条内容已经在记忆里了。' : `已记住：${content}`
      }
      case 'create_artifact': {
        let name = String(args.name ?? '').trim() || '未命名文档.md'
        if (!/\.(md|markdown|txt)$/i.test(name)) name = `${name}.md`
        const content = String(args.content ?? '')
        if (!content.trim()) { fail(`生成文档：${name}（内容为空）`); return 'create_artifact 需要提供完整的 content。' }
        setState(current => addFile(current, { name, content, origin: '模型生成' }))
        done(`生成文档：${name}`)
        return `已生成文档「${name}」并放入资料库`
      }
      case 'request_open_url':
      case 'request_fetch_url':
      case 'request_read_file':
      case 'request_write_file': {
        const label = toolLabel(call.name)
        if (call.name === 'request_write_file') {
          const target = String(args.path ?? '').trim()
          const content = String(args.content ?? '')
          if (!target) { fail(`${label}：缺少路径`); return 'request_write_file 需要提供 path。' }
          return await gate({ type: 'write_file', target, content, reason: String(args.reason ?? '') }, assistantId, label)
        }
        const target = String(args.url ?? args.path ?? '').trim()
        if (!target) { fail(`${label}：缺少地址`); return `${call.name} 需要提供${call.name === 'request_read_file' ? ' path' : ' url'}。` }
        const type: ActionKind = call.name === 'request_open_url' ? 'open_url' : call.name === 'request_fetch_url' ? 'fetch_url' : 'read_file'
        return await gate({ type, target, reason: String(args.reason ?? '') } as ApprovalDraft, assistantId, label)
      }
      default:
        fail(`不支持的指令：${call.name}`)
        return `不支持的指令：${call.name}`
    }
  }, [addStep, gate, setStep])

  /* ---------- 对话主流程 ---------- */

  const send = useCallback(async (override?: string) => {
    const text = (override ?? draft).trim()
    if (!text || busy) return
    if (!apiKey.trim()) { setSettingsOpen(true); notify('请先在设置中填写接口密钥。'); return }

    const file = attachment
    const current = stateRef.current
    const history: WireMessage[] = activeSession(current).messages
      .filter(message => message.content.trim() && message.role !== 'system')
      .slice(-23)
      .map(message => ({ role: message.role as 'user' | 'assistant', content: message.content }))
    history.push({ role: 'user', content: file ? `${text}\n\n参考资料：${file.name}\n${file.content.slice(0, 20_000)}` : text })

    setDraft('')
    setAttachment(null)
    const assistantId = crypto.randomUUID()
    setState(current => {
      const appended = appendMessage(current, 'user', text, file?.name)
      return {
        ...appended,
        sessions: appended.sessions.map(item => item.id === appended.activeSessionId
          ? { ...item, messages: [...item.messages, { id: assistantId, role: 'assistant' as const, content: '', createdAt: new Date().toISOString(), steps: [] as Step[] }] }
          : item),
      }
    })

    setBusy(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const finalText = await runAgent({
        settings: model,
        systemPrompt: buildSystemPrompt(runContext()),
        history,
        execute: call => executeTool(call, assistantId),
        onText: roundText => setState(current => updateMessage(current, assistantId, { content: roundText })),
        onRoundStart: () => setState(current => updateMessage(current, assistantId, { content: '' })),
        signal: controller.signal,
      })
      setState(current => updateMessage(current, assistantId, { content: finalText || '这一轮没有新的输出。需要我继续推进什么？' }))
    } catch (cause) {
      const aborted = cause instanceof DOMException && cause.name === 'AbortError'
      const reason = cause instanceof Error ? cause.message : '生成过程中出现了问题。'
      if (aborted) {
        if (!findMessage(stateRef.current, assistantId)?.content.trim()) {
          setState(current => updateMessage(current, assistantId, { content: '已停止生成。' }))
        }
      } else {
        notify(reason)
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }, [apiKey, attachment, busy, draft, executeTool, model, notify, runContext])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setBusy(false)
  }, [])

  /* ---------- 主动生成：计划 / 想法 / 简报 ---------- */

  const planFor = useCallback(async (goalId: string) => {
    if (!apiKey.trim()) { setSettingsOpen(true); notify('请先在设置中填写接口密钥。'); return }
    const goal = stateRef.current.goals.find(item => item.id === goalId)
    if (!goal) return
    setPlanningId(goalId)
    const controller = new AbortController()
    planAbortRef.current = controller
    try {
      const steps = await generatePlan(model, { title: goal.title, why: goal.why }, runContext(), controller.signal)
      setState(current => attachPlan(current, goalId, steps))
      notify(`已为目标「${goal.title}」生成 ${steps.length} 步计划`)
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        notify(cause instanceof Error ? cause.message : '生成计划时出现了问题。')
      }
    } finally {
      setPlanningId(null)
      planAbortRef.current = null
    }
  }, [apiKey, model, notify, runContext])

  const refreshIdeas = useCallback(async () => {
    if (!apiKey.trim()) { setSettingsOpen(true); notify('请先在设置中填写接口密钥。'); return }
    setIdeasBusy(true)
    const controller = new AbortController()
    ideasAbortRef.current = controller
    try {
      const drafts = await generateSuggestions(model, runContext(), controller.signal)
      if (!drafts.length) { notify('天琴这次没有想出新的建议，稍后再试。'); return }
      setState(current => drafts.reduce((acc, item) => addSuggestion(acc, item), current))
      notify(`天琴想到了 ${drafts.length} 个新想法`)
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        notify(cause instanceof Error ? cause.message : '生成想法时出现了问题。')
      }
    } finally {
      setIdeasBusy(false)
      ideasAbortRef.current = null
    }
  }, [apiKey, model, notify, runContext])

  const refreshBriefing = useCallback(async () => {
    if (!apiKey.trim()) { setSettingsOpen(true); notify('请先在设置中填写接口密钥。'); return }
    setBriefingBusy(true)
    const controller = new AbortController()
    briefingAbortRef.current = controller
    try {
      const content = await generateBriefing(model, runContext(), controller.signal)
      setState(current => setBriefing(current, content, current.settings.interests))
      notify('简报已更新。')
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        notify(cause instanceof Error ? cause.message : '生成简报时出现了问题。')
      }
    } finally {
      setBriefingBusy(false)
      briefingAbortRef.current = null
    }
  }, [apiKey, model, notify, runContext])

  /* ---------- 文件 ---------- */

  const pickFile = useCallback(async () => {
    try {
      if (native) {
        const picked = await openDialog({ multiple: false, directory: false, title: '选择要加入工作台的文本文件' })
        if (!picked || typeof picked !== 'string') return
        const content = await readTextPath(picked)
        const name = picked.split(/[\\/]/).pop() ?? picked
        setAttachment({ name, content })
        notify(`已读取 ${name}`)
        return
      }
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.txt,.md,.markdown,.json,.csv,.html,.htm,.ts,.tsx,.js,.jsx,.css,.py,.rs,.go,.java,.vue,.sql,.yml,.yaml,.toml,text/*'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        if (file.size > MAX_TEXT_FILE) { notify('文件超过 200 KB，请先拆分后再加入工作台。'); return }
        const content = await file.text()
        setAttachment({ name: file.name, content })
        notify(`已读取 ${file.name}`)
      }
      input.click()
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : '读取文件时出现了问题。')
    }
  }, [native, notify])

  const readPathIntoWorkspace = useCallback(async (path: string) => {
    setFileBusy(true)
    try {
      const content = await readTextPath(path)
      const name = path.split(/[\\/]/).pop() ?? path
      setState(current => addFile(current, { name, path, content, origin: '已选择' }))
      notify(`已加入 ${name}`)
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : '读取文件时出现了问题。')
    } finally {
      setFileBusy(false)
    }
  }, [notify])

  const useFileInChat = useCallback((file: WorkspaceFile) => {
    if (!file.content) { notify('这份资料的内容没有保存在本地，请重新读取后再使用。'); return }
    setAttachment({ name: file.name, content: file.content })
    setView('chat')
    notify(`已把 ${file.name} 加入本轮对话`)
  }, [notify])

  const createWorkspaceFile = useCallback((name: string, content: string) => {
    setState(current => addFile(current, { name, path: name, content, origin: '模型生成' }))
    notify(`已保存 ${name}`)
  }, [notify])

  /* ---------- 设置与数据 ---------- */

  const saveSettings = useCallback((next: AgentSettings & { apiKey: string }) => {
    setState(current => {
      let next1 = updateSettings(current, { endpoint: next.endpoint, model: next.model, interests: next.interests })
      for (const kind of PERMISSION_KINDS) {
        if (next1.settings.permissions[kind] !== next.permissions[kind]) next1 = setPermission(next1, kind, next.permissions[kind])
      }
      return next1
    })
    setApiKey(next.apiKey)
    setSettingsOpen(false)
    notify('设置已保存。')
  }, [notify])

  const exportWorkspace = useCallback(() => {
    const data = exportState(stateRef.current)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `lyra-workspace-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    notify('已导出工作台备份。')
  }, [notify])

  const importWorkspace = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const next = importState(await file.text())
        setState(next)
        notify('已导入备份，工作台数据已恢复。')
      } catch {
        notify('导入失败：文件不是有效的工作台备份。')
      }
    }
    input.click()
  }, [notify])

  /* ---------- 视图切换 ---------- */

  const navigateHit = useCallback((hit: SearchHit) => {
    setView(hit.view)
    if (hit.sessionId) {
      const id = hit.sessionId
      setState(current => selectSession(current, id))
    }
    setSearchOpen(false)
  }, [])

  const chatAboutGoal = useCallback((goalId: string) => {
    const goal = stateRef.current.goals.find(item => item.id === goalId)
    if (!goal) return
    setDraft(`我想推进目标「${goal.title}」${goal.why ? `（${goal.why}）` : ''}，请先帮我制定计划，再从第一步开始。`)
    setView('chat')
  }, [])

  const chatIdea = useCallback((text: string) => {
    setDraft(text)
    setView('chat')
  }, [])

  const removeFileAttachment = useCallback(() => {
    const name = attachment?.name
    const target = stateRef.current.files.find(item => item.name === name)
    if (target) {
      setState(current => removeFile(current, target.id))
      setAttachment(null)
      notify('已从工作台移除这份文件。')
    } else {
      setAttachment(null)
      notify('这次附件已经取消。')
    }
  }, [attachment, notify])

  const toggleTheme = useCallback(() => {
    setTheme(current => current === 'light' ? 'dark' : 'light')
  }, [])

  const commit = useCallback((message: string, updater: (current: WorkspaceState) => WorkspaceState) => {
    setState(current => updater(current))
    if (message) notify(message)
  }, [notify])

  const body = (() => {
    if (view === 'chat') {
      return (
        <>
          {pending.length ? <ApprovalBar approvals={pending} onApprove={id => void resolveApproval(id, 'approve')} onReject={id => void resolveApproval(id, 'reject')} /> : null}
          <ChatView
            session={session}
            thinking={busy}
            draft={draft}
            attachment={attachment}
            onDraft={setDraft}
            onSend={() => void send()}
            onStop={stop}
            onPickFile={() => void pickFile()}
            onClearAttachment={() => setAttachment(null)}
            onRemoveFileAttachment={removeFileAttachment}
            onOpenGoals={() => setView('goals')}
            empty={session.messages.length === 0}
          />
        </>
      )
    }
    if (view === 'goals') {
      return (
        <GoalsView
          state={state}
          busy={Boolean(planningId)}
          planningId={planningId}
          onCreateGoal={(title, why) => commit('', current => createGoal(current, title, why))}
          onPlan={id => void planFor(id)}
          onStatus={(id, status: GoalStatus) => commit('', current => updateGoal(current, id, { status }))}
          onRemoveGoal={id => commit('已删除这个目标。', current => removeGoal(current, id))}
          onToggleTask={id => commit('', current => toggleTask(current, id))}
          onAddTask={(goalId, title) => commit('', current => createTask(current, title, goalId))}
          onRemoveTask={id => commit('已删除这条任务。', current => removeTask(current, id))}
          onChatAbout={chatAboutGoal}
        />
      )
    }
    if (view === 'ideas') {
      return (
        <IdeasView
          state={state}
          busy={ideasBusy}
          briefingBusy={briefingBusy}
          onGenerate={() => void refreshIdeas()}
          onBriefing={() => void refreshBriefing()}
          onAccept={id => commit('已采纳为任务。', current => acceptSuggestion(current, id))}
          onDismiss={id => commit('', current => dismissSuggestion(current, id))}
          onChat={chatIdea}
        />
      )
    }
    if (view === 'memory') {
      return (
        <MemoryView
          state={state}
          onAdd={content => commit('天琴记住了。', current => saveMemory(current, content, '手动添加'))}
          onForget={id => commit('已遗忘这条记忆。', current => forgetMemory(current, id))}
          onPin={id => commit('', current => toggleMemoryPin(current, id))}
        />
      )
    }
    if (view === 'files') {
      return (
        <FilesView
          state={state}
          native={native}
          busy={fileBusy}
          onPick={() => void pickFile()}
          onReadPath={path => void readPathIntoWorkspace(path)}
          onCreate={createWorkspaceFile}
          onRemove={id => commit('已移除这份资料。', current => removeFile(current, id))}
          onUseInChat={useFileInChat}
        />
      )
    }
    return (
      <AuditView
        state={state}
        onApprove={id => void resolveApproval(id, 'approve')}
        onReject={id => void resolveApproval(id, 'reject')}
      />
    )
  })()

  const title = view === 'chat' ? session.title : VIEW_TITLE[view]

  return (
    <div className={`app${sidebarOpen ? ' sidebar-visible' : ''}`}>
      <Sidebar
        state={state}
        view={view}
        theme={theme}
        onView={next => { setView(next); setSidebarOpen(false) }}
        onSelect={id => { setState(current => selectSession(current, id)); setView('chat'); setSidebarOpen(false) }}
        onNew={() => { setState(startSession); setView('chat'); setSidebarOpen(false) }}
        onRemove={id => commit('已移除这条对话。', current => removeSession(current, id))}
        onSettings={() => setSettingsOpen(true)}
        onSearch={() => setSearchOpen(true)}
        onTheme={toggleTheme}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="workspace">
        <header className="topbar">
          <button className="icon-btn menu-btn" type="button" onClick={() => setSidebarOpen(true)} title="展开导航"><PanelLeft size={17} /></button>
          <div className="topbar-title">
            <strong>{title}</strong>
            <span>{platformLabel()} · {describeWorkspace(state)}</span>
          </div>
          <div className="topbar-right">
            <span className="model-chip"><Sparkles size={13} />{state.settings.model || '未配置模型'}</span>
            <button className="icon-btn" type="button" onClick={() => setSearchOpen(true)} title="全局搜索（Ctrl+K）"><Search size={16} /></button>
          </div>
        </header>

        <div className="body-area">
          <section className="content">{body}</section>
        </div>
      </main>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
      {settingsOpen ? (
        <SettingsDialog
          settings={state.settings}
          onSave={saveSettings}
          onExport={exportWorkspace}
          onImport={importWorkspace}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      {searchOpen ? (
        <SearchDialog
          state={state}
          onClose={() => setSearchOpen(false)}
          onNavigate={navigateHit}
        />
      ) : null}
    </div>
  )
}
