import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { openUrl } from '@tauri-apps/plugin-opener'
import { PanelLeft, Sparkles } from 'lucide-react'
import {
  activeApprovals,
  activeSession,
  addFile,
  appendMessage,
  approveAction,
  createInitialState,
  createItem,
  describeWorkspace,
  failAction,
  finishAction,
  rejectAction,
  removeFile,
  removeItem,
  removeSession,
  selectSession,
  startSession,
  toggleItem,
  updateItem,
  updateMessage,
  type Approval,
  type ApprovalDraft,
  type Message,
  type ModelSettings,
  type Step,
  type View,
  type WorkspaceFile,
  type WorkspaceState,
} from './core'
import { fetchPage, streamCompletion, type RunContext, type ToolCall } from './ai'
import { MAX_TEXT_FILE, hasNativeFileAccess, platformLabel, readTextPath, writeTextPath } from './platform'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import ContextPanel from './components/ContextPanel'
import ApprovalBar from './components/ApprovalBar'
import SettingsDialog from './components/SettingsDialog'
import ItemsView from './components/ItemsView'
import FilesView from './components/FilesView'
import { ActionsView, AuditView } from './components/RecordViews'

const WORKSPACE_KEY = 'muse-pro-workspace-v2'
const THEME_KEY = 'muse-pro-theme-v1'
const FILE_LIMIT = 6

type Persisted = { state: WorkspaceState; theme: 'light' | 'dark' }

function restore(): Persisted | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Persisted
    if (!parsed?.state?.sessions?.length) return null
    return parsed
  } catch {
    return null
  }
}

function persist(state: WorkspaceState, theme: 'light' | 'dark') {
  try {
    const slim: WorkspaceState = {
      ...state,
      files: state.files.map((file, index, all) => ({
        ...file,
        content: index >= all.length - FILE_LIMIT ? file.content.slice(0, 24_000) : '',
      })),
    }
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ state: slim, theme }))
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* 存储空间不足时保持内存中的状态不变 */
  }
}

function stepId() {
  return `step_${Math.random().toString(36).slice(2, 10)}`
}

function titleFor(name: string): string {
  if (name === 'create_task') return '记录任务'
  if (name === 'create_goal') return '记录目标'
  if (name.includes('fetch')) return '读取网页'
  if (name.includes('read_file')) return '读取文件'
  if (name.includes('write_file')) return '写入文件'
  return '打开网页'
}

export default function App() {
  const boot = useMemo(restore, [])
  const [state, setState] = useState<WorkspaceState>(() => boot?.state ?? createInitialState())
  const [theme, setTheme] = useState<'light' | 'dark'>(() => boot?.theme ?? 'light')
  const [view, setView] = useState<View>('chat')
  const [settings, setSettings] = useState<ModelSettings>({ endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat', apiKey: '' })
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<{ name: string; content: string } | null>(null)
  const [thinking, setThinking] = useState(false)
  const [toast, setToast] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  useEffect(() => { persist(state, theme) }, [state, theme])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const session = activeSession(state)
  const pending = activeApprovals(state)
  const native = hasNativeFileAccess()

  const notify = useCallback((message: string) => setToast(message), [])

  const commit = useCallback((message: string, updater: (current: WorkspaceState) => WorkspaceState) => {
    setState(current => updater(current))
    if (message) notify(message)
  }, [notify])

  const toggleTheme = useCallback(() => {
    setTheme(current => current === 'light' ? 'dark' : 'light')
  }, [])

  const patchAssistant = useCallback((id: string, mutate: (steps: Step[]) => Step[]) => {
    setState(current => {
      const target = current.sessions.find(item => item.id === current.activeSessionId)
      if (!target) return current
      const message = target.messages.find(item => item.id === id)
      if (!message) return current
      return updateMessage(current, id, { steps: mutate(message.steps ?? []) })
    })
  }, [])

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
    setBusy(true)
    try {
      const content = await readTextPath(path)
      const name = path.split(/[\\/]/).pop() ?? path
      commit(`已加入 ${name}`, current => addFile(current, { name, path, content, origin: '已选择' }))
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : '读取文件时出现了问题。')
    } finally {
      setBusy(false)
    }
  }, [commit, notify])

  const execute = useCallback(async (approval: Approval) => {
    if (approval.type === 'open_url') {
      if (native) await openUrl(approval.target)
      else window.open(approval.target, '_blank', 'noopener,noreferrer')
      return `已在浏览器中打开 ${approval.target}`
    }
    if (approval.type === 'fetch_url') {
      const page = await fetchPage(approval.target)
      return `已读取《${page.title}》共 ${page.text.length} 字${page.truncated ? '（内容较长，已截断）' : ''}`
    }
    if (approval.type === 'read_file') {
      const content = await readTextPath(approval.target)
      const name = approval.target.split(/[\\/]/).pop() ?? approval.target
      setState(current => addFile(current, { name, path: approval.target, content, origin: '已选择' }))
      return `已读取 ${name}（${content.length} 字）`
    }
    if (!native) {
      const local = state.files.find(item => item.path === approval.target || item.name === approval.target)
      if (local) {
        setState(current => addFile(current, { name: local.name, path: local.path, content: approval.content, origin: '模型写入' }))
        return `已更新工作台内的 ${local.name}`
      }
    }
    const destination = await writeTextPath(approval.target, approval.content)
    const name = destination.split(/[\\/]/).pop() ?? destination
    setState(current => addFile(current, { name, path: destination, content: approval.content, origin: '模型写入' }))
    return `已写入 ${name}（${approval.content.length} 字）`
  }, [native, state.files])

  const runCalls = useCallback(async (calls: ToolCall[], assistantId: string) => {
    for (const call of calls) {
      let args: Record<string, string> = {}
      try {
        args = JSON.parse(call.arguments || '{}') as Record<string, string>
      } catch {
        patchAssistant(assistantId, steps => [...steps, { id: stepId(), label: `${titleFor(call.name)}（参数不完整）`, state: 'failed' }])
        continue
      }
      const id = stepId()
      patchAssistant(assistantId, steps => [...steps, { id, label: titleFor(call.name), state: 'running' }])
      await new Promise(resolve => window.setTimeout(resolve, 260))

      if (call.name === 'create_task' || call.name === 'create_goal') {
        const collection = call.name === 'create_task' ? 'tasks' : 'goals'
        const title = (args.title ?? '').trim()
        if (!title) {
          patchAssistant(assistantId, steps => steps.map(step => step.id === id ? { ...step, state: 'failed' } : step))
          continue
        }
        setState(current => createItem(current, collection, title))
        patchAssistant(assistantId, steps => steps.map(step => step.id === id ? { ...step, label: `${titleFor(call.name)}：${title}`, state: 'done' } : step))
        continue
      }

      let request: ApprovalDraft | null = null
      if (call.name === 'request_open_url' && args.url) request = { type: 'open_url', target: args.url, reason: args.reason ?? '' }
      if (call.name === 'request_fetch_url' && args.url) request = { type: 'fetch_url', target: args.url, reason: args.reason ?? '' }
      if (call.name === 'request_read_file' && args.path) request = { type: 'read_file', target: args.path, reason: args.reason ?? '' }
      if (call.name === 'request_write_file' && args.path) request = { type: 'write_file', target: args.path, content: args.content ?? '', reason: args.reason ?? '' }

      const draftRequest = request
      if (!draftRequest) {
        patchAssistant(assistantId, steps => steps.map(step => step.id === id ? { ...step, label: `${titleFor(call.name)}（信息不完整）`, state: 'failed' } : step))
        continue
      }

      let label = '打开网页'
      if (draftRequest.type === 'fetch_url') label = '读取网页'
      else if (draftRequest.type === 'read_file') label = '读取文件'
      else if (draftRequest.type === 'write_file') label = '写入文件'

      setState(current => {
        const approval: Approval = { ...draftRequest, id: crypto.randomUUID(), status: 'pending', createdAt: new Date().toISOString(), sessionId: current.activeSessionId }
        return {
          ...current,
          approvals: [approval, ...current.approvals],
          audit: [...current.audit, { id: crypto.randomUUID(), kind: 'approval_requested', title: '等待审批', detail: `${label}：${draftRequest.target}`, createdAt: new Date().toISOString(), sessionId: current.activeSessionId }],
        }
      })
      patchAssistant(assistantId, steps => steps.map(step => step.id === id ? { ...step, label: `${label}：等待你确认`, state: 'pending' } : step))
    }
  }, [patchAssistant])

  const send = useCallback(async (override?: string) => {
    const text = (override ?? draft).trim()
    if (!text || thinking) return
    if (!settings.apiKey.trim()) { setSettingsOpen(true); notify('请先填写模型接口密钥。'); return }

    const file = attachment
    const history: Message[] = [
      ...session.messages,
      { id: crypto.randomUUID(), role: 'user', content: text, createdAt: new Date().toISOString(), attachment: file?.name },
    ]

    setDraft('')
    setAttachment(null)

    const assistantId = crypto.randomUUID()
    setState(current => {
      const appended = appendMessage(current, 'user', text, file?.name)
      return updateMessage(
        { ...appended, sessions: appended.sessions.map(item => item.id === appended.activeSessionId ? { ...item, messages: [...item.messages, { id: assistantId, role: 'assistant' as const, content: '', createdAt: new Date().toISOString(), steps: [] }] } : item) },
        assistantId,
        { steps: [] },
      )
    })

    setThinking(true)
    const controller = new AbortController()
    abortRef.current = controller
    let buffer = ''

    try {
      const context: RunContext = {
        tasks: state.tasks.map(item => ({ title: item.title, done: item.done })),
        goals: state.goals.map(item => ({ title: item.title, done: item.done })),
        fileNames: [...state.files.map(item => item.name), ...(file ? [file.name] : [])],
      }
      const payload: Message[] = file
        ? [...history.slice(0, -1), { ...history[history.length - 1], content: `${text}\n\n参考资料：\n${file.content.slice(0, 20_000)}` }]
        : history

      patchAssistant(assistantId, steps => [...steps, { id: stepId(), label: '思考中', state: 'running' }])
      await streamCompletion(settings, payload, context, event => {
        if (event.type === 'text') {
          buffer += event.value
          const snapshot = buffer
          setState(current => updateMessage(current, assistantId, { content: snapshot }))
        } else {
          patchAssistant(assistantId, steps => steps.map(step => step.state === 'running' ? { ...step, state: 'done' } : step))
          void runCalls(event.value, assistantId)
        }
      }, controller.signal)
      setState(current => updateMessage(current, assistantId, { content: buffer || '我已经把上面的步骤记录到工作台，需要我继续推进哪一件事？' }))
    } catch (cause) {
      const aborted = cause instanceof DOMException && cause.name === 'AbortError'
      const reason = cause instanceof Error ? cause.message : '生成过程中出现了问题。'
      const fallback = buffer || (aborted ? '已停止生成。' : reason)
      setState(current => updateMessage(current, assistantId, { content: fallback }))
      notify(reason)
    } finally {
      setThinking(false)
      abortRef.current = null
    }
  }, [attachment, draft, notify, patchAssistant, runCalls, session.messages, settings, state.files, state.goals, state.tasks, thinking])

  const stop = useCallback(() => {
    abortRef.current?.abort()
    setThinking(false)
  }, [])

  const resolveApproval = useCallback(async (id: string, decision: 'approve' | 'reject') => {
    const approval = state.approvals.find(item => item.id === id)
    if (!approval || approval.status !== 'pending') return
    if (decision === 'reject') {
      commit('已拒绝这个请求。', current => rejectAction(current, id))
      return
    }
    setState(current => approveAction(current, id))
    try {
      const result = await execute(approval)
      const kind = approval.type === 'open_url' ? 'url_opened' : approval.type === 'fetch_url' ? 'url_fetched' : approval.type === 'read_file' ? 'file_read' : 'file_written'
      setState(current => finishAction(current, id, kind, '操作已执行', result))
      notify(result)
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : '执行这个操作时出现了问题。'
      setState(current => failAction(current, id, reason))
      notify(reason)
    }
  }, [commit, execute, notify, state.approvals])

  const useFileInChat = useCallback((file: WorkspaceFile) => {
    if (!file.content) { notify('这份资料的内容没有保存在本地，请重新读取后再使用。'); return }
    setAttachment({ name: file.name, content: file.content })
    setView('chat')
    notify(`已把 ${file.name} 加入本轮对话`)
  }, [notify])

  const createWorkspaceFile = useCallback((name: string, content: string) => {
    commit(`已保存 ${name}`, current => addFile(current, { name, path: name, content, origin: '模型写入' }))
  }, [commit])

  const body = (() => {
    if (view === 'chat') {
      return (
        <>
          <ApprovalBar approvals={pending} onApprove={id => void resolveApproval(id, 'approve')} onReject={id => void resolveApproval(id, 'reject')} />
          <ChatView
            session={session}
            thinking={thinking}
            draft={draft}
            attachment={attachment}
            onDraft={setDraft}
            onSend={() => void send()}
            onStop={stop}
            onPickFile={() => void pickFile()}
            onClearAttachment={() => setAttachment(null)}
            onRemoveFileAttachment={() => {
              const name = attachment?.name ?? session.messages.at(-1)?.attachment
              const target = state.files.find(item => item.name === name)
              if (target) commit('已从工作台移除这份文件。', current => removeFile(current, target.id))
              else { setAttachment(null); notify('这次附件已经取消。') }
            }}
            empty={session.messages.length === 0}
          />
        </>
      )
    }
    if (view === 'tasks' || view === 'goals') {
      return (
        <ItemsView
          collection={view}
          items={view === 'tasks' ? state.tasks : state.goals}
          onCreate={(collection, title) => commit('', current => createItem(current, collection, title))}
          onToggle={(collection, id) => commit('', current => toggleItem(current, collection, id))}
          onNote={(collection, id, note) => commit('', current => updateItem(current, collection, id, note))}
          onRemove={(collection, id) => commit('', current => removeItem(current, collection, id))}
        />
      )
    }
    if (view === 'files') {
      return (
        <FilesView
          files={state.files}
          native={native}
          busy={busy}
          onPick={() => void pickFile()}
          onReadPath={path => void readPathIntoWorkspace(path)}
          onCreate={createWorkspaceFile}
          onRemove={id => commit('已移除这份资料。', current => removeFile(current, id))}
          onUseInChat={useFileInChat}
        />
      )
    }
    if (view === 'actions') return <ActionsView approvals={state.approvals} actions={state.actions} />
    return <AuditView audit={state.audit} />
  })()

  return (
    <div className={`app${sidebarOpen ? ' sidebar-visible' : ''}`}>
      <Sidebar
        state={state}
        view={view}
        onView={next => { setView(next); setSidebarOpen(false) }}
        onSelect={id => { setState(current => selectSession(current, id)); setView('chat'); setSidebarOpen(false) }}
        onNew={() => { setState(startSession); setView('chat'); setSidebarOpen(false) }}
        onRemove={id => commit('已移除这条对话。', current => removeSession(current, id))}
        onSettings={() => setSettingsOpen(true)}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="workspace">
        <header className="topbar">
          <button className="icon-btn menu-btn" type="button" onClick={() => setSidebarOpen(true)} title="展开导航"><PanelLeft size={17} /></button>
          <div className="topbar-title">
            <strong>{session.title}</strong>
            <span>{platformLabel()} · {describeWorkspace(state)}</span>
          </div>
          <div className="topbar-right">
            <span className="model-chip"><Sparkles size={13} />{settings.model || '未配置模型'}</span>
            <button className="ghost-btn" type="button" onClick={toggleTheme}>{theme === 'light' ? '深色模式' : '浅色模式'}</button>
          </div>
        </header>

        <div className="body-area">
          <section className="content">{body}</section>
          {view === 'chat' ? (
            <ContextPanel
              state={state}
              onCreate={(collection, title) => commit('', current => createItem(current, collection, title))}
              onToggle={(collection, id) => commit('', current => toggleItem(current, collection, id))}
              onOpenFile={() => setView('files')}
              onView={next => setView(next)}
            />
          ) : null}
        </div>
      </main>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
      {settingsOpen ? <SettingsDialog settings={settings} onSave={next => { setSettings(next); setSettingsOpen(false); notify('模型设置已更新。') }} onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  )
}
