import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { isTauri } from '@tauri-apps/api/core'

export type ModelSettings = { endpoint: string; model: string; apiKey: string }
export type ToolCall = { id: string; name: string; arguments: string }

/** 发给模型的有线消息格式（含工具回传轮次） */
export type WireMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export type StreamEvent =
  | { type: 'text'; value: string }
  | { type: 'calls'; value: ToolCall[] }

export type RunContext = {
  goals: { title: string; status: string; planSteps: number; openTasks: number }[]
  tasks: { title: string; done: boolean; goal?: string }[]
  memories: string[]
  fileNames: string[]
  interests: string[]
  briefing?: string
}

export const TOOL_LABEL: Record<string, string> = {
  create_task: '记录任务',
  create_goal: '记录目标',
  propose_plan: '制定计划',
  save_memory: '沉淀记忆',
  create_artifact: '生成文档',
  request_open_url: '打开网页',
  request_fetch_url: '读取网页',
  request_read_file: '读取文件',
  request_write_file: '写入文件',
}

export function toolLabel(name: string): string {
  return TOOL_LABEL[name] ?? '执行指令'
}

export const controlTools = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: '在任务清单中新增一条待办任务，可挂在某个目标下。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '任务标题，一句话说明要推进的事项' },
          goal_title: { type: 'string', description: '可选。关联目标的标题；不确定时可省略' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_goal',
      description: '新增一个长期目标。当用户表达出想达成的事情时使用。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '目标标题' },
          why: { type: 'string', description: '可选。为什么重要或期望的结果' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_plan',
      description: '为某个目标制定分步执行计划，会替换该目标原有的计划。',
      parameters: {
        type: 'object',
        properties: {
          goal_title: { type: 'string', description: '目标的标题' },
          steps: {
            type: 'array',
            description: '3 到 6 个步骤，按推进顺序排列',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: '这一步要完成什么，用动词开头' },
                detail: { type: 'string', description: '可选。怎么做、标准或截止时间' },
              },
              required: ['title'],
            },
          },
          note: { type: 'string', description: '可选。整体思路或前提假设' },
        },
        required: ['goal_title', 'steps'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_memory',
      description: '把一条长期有效的信息存入记忆：用户的偏好、背景事实、长期承诺。不要保存一次性或临时信息。',
      parameters: {
        type: 'object',
        properties: {
          content: { type: 'string', description: '一句简短、自包含的陈述' },
        },
        required: ['content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_artifact',
      description: '把整理好的成果保存为 Markdown 文档，放进资料库。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '文档名，以 .md 结尾' },
          content: { type: 'string', description: '完整的 Markdown 内容' },
        },
        required: ['name', 'content'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_open_url',
      description: '请求在浏览器中打开外部网页。该请求必须由用户审批之后才会执行。',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: '完整的 http 或 https 地址' }, reason: { type: 'string', description: '打开这个网页的原因' } },
        required: ['url', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_fetch_url',
      description: '请求读取某个网页的正文内容作为参考。读取前必须由用户审批。',
      parameters: {
        type: 'object',
        properties: { url: { type: 'string', description: '完整的 http 或 https 地址' }, reason: { type: 'string', description: '读取这个网页的原因' } },
        required: ['url', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_read_file',
      description: '请求读取用户设备上的一个文本文件。读取前必须由用户审批。',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: '文件的绝对路径' }, reason: { type: 'string', description: '读取这个文件的原因' } },
        required: ['path', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_write_file',
      description: '请求把整理好的内容写入用户设备上的文件。写入前必须由用户审批并核对内容。',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目标文件的绝对路径或工作空间内的文件名' },
          content: { type: 'string', description: '要写入的完整文件内容' },
          reason: { type: 'string', description: '写入这个文件的原因' },
        },
        required: ['path', 'content', 'reason'],
      },
    },
  },
]

const PERSONA = [
  '你是天琴（Lyra），运行在用户本机的私人 AI 智能体。你的职责不是陪聊，而是替用户把事情推进落地：理解目标、制定计划、跟进任务、整理资料、沉淀重要信息。',
  '回答使用简体中文，直接给结论和下一步，不复述用户的话，不使用表情符号。',
  '当用户表达一个想达成的目标时：先用 create_goal 记录目标，再用 propose_plan 给出 3 到 6 步可执行的计划，每一步以动词开头、有明确产出。',
  '当用户透露长期有效的偏好、背景事实或承诺时，调用 save_memory 保存一句简短、自包含的陈述；一次对话里最多保存两条，不要保存临时信息。',
  '当用户需要一份整理好的成果文档时，调用 create_artifact 保存为 Markdown。',
  '打开网页、读取网页、读取文件、写入文件都必须提出请求并等待用户审批。你会在下一轮收到执行结果；如果用户拒绝了，接受这个结果并调整方案，不要重复提出同样的请求。',
  '不要声称已经完成尚未执行的操作。信息不足时，先问最关键的一个问题，一次只问一个。',
].join('\n')

export function describeContext(context: RunContext): string {
  const lines: string[] = ['当前工作台状态：']
  lines.push(context.goals.length
    ? context.goals.map(goal => `目标：${goal.title}（${goal.status}，计划 ${goal.planSteps} 步，待办 ${goal.openTasks}）`).join('\n')
    : '目标：暂无')
  lines.push(context.tasks.length
    ? `任务：${context.tasks.slice(0, 20).map(task => `${task.title}${task.goal ? `〔${task.goal}〕` : ''}${task.done ? '（已完成）' : ''}`).join('；')}${context.tasks.length > 20 ? ` 等共 ${context.tasks.length} 项` : ''}`
    : '任务：暂无')
  lines.push(context.memories.length ? `已记住：${context.memories.join('；')}` : '已记住：暂无')
  lines.push(context.fileNames.length ? `资料库文件：${context.fileNames.join('；')}` : '资料库文件：暂无')
  if (context.interests.length) lines.push(`用户关注的领域：${context.interests.join('、')}`)
  if (context.briefing) lines.push(`上一份简报：${context.briefing.slice(0, 200)}`)
  return lines.join('\n')
}

export function buildSystemPrompt(context: RunContext): string {
  return `${PERSONA}\n\n${describeContext(context)}`
}

function validateEndpoint(endpoint: string): URL {
  const url = new URL(endpoint)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('接口地址必须以 http 或 https 开头。')
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('远程模型接口必须使用 https 地址。')
  return url
}

/** 调用对话接口：流式回传文本，结束时回传完整的工具调用列表 */
export async function chatCompletion(
  settings: ModelSettings,
  wire: WireMessage[],
  tools: typeof controlTools | [],
  onEvent: (event: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const endpoint = validateEndpoint(settings.endpoint)
  if (!settings.model) throw new Error('请先填写模型名称。')
  const transport = isTauri() ? tauriFetch : globalThis.fetch
  const response = await transport(endpoint.toString(), {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${settings.apiKey}` },
    body: JSON.stringify({ model: settings.model, stream: true, messages: wire, tools: tools.length ? tools : undefined }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(readError(text) || `模型接口返回了错误状态（${response.status}）。`)
  }
  if (!response.body) {
    const text = await response.text()
    const payload = safeJson<{ choices?: { message?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] }>(text)
    const message = payload?.choices?.[0]?.message
    if (message?.content) onEvent({ type: 'text', value: message.content })
    if (message?.tool_calls?.length) {
      onEvent({ type: 'calls', value: message.tool_calls.map((call, index) => ({ id: call.id ?? `call_${index}`, name: call.function.name, arguments: call.function.arguments })) })
    }
    return
  }
  await readStream(response.body, onEvent, signal)
}

async function readStream(body: ReadableStream<Uint8Array>, onEvent: (event: StreamEvent) => void, signal?: AbortSignal): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  const acc = new Map<number, ToolCall>()
  let buffer = ''
  try {
    for (;;) {
      if (signal?.aborted) throw new DOMException('已停止生成。', 'AbortError')
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue
        const chunk = safeJson<{
          choices?: { delta?: { content?: string | null; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] } }[]
          error?: { message?: string }
        }>(payload)
        if (!chunk) continue
        if (chunk.error?.message) throw new Error(chunk.error.message)
        const delta = chunk.choices?.[0]?.delta
        if (!delta) continue
        if (delta.content) onEvent({ type: 'text', value: delta.content })
        for (const item of delta.tool_calls ?? []) {
          const index = item.index ?? 0
          const current = acc.get(index) ?? { id: item.id ?? `call_${index}`, name: '', arguments: '' }
          if (item.id) current.id = item.id
          if (item.function?.name) current.name = item.function.name
          if (item.function?.arguments) current.arguments += item.function.arguments
          acc.set(index, current)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  const calls = [...acc.values()].filter(item => item.name)
  if (calls.length) onEvent({ type: 'calls', value: calls })
}

function safeJson<T>(text: string): T | null {
  try { return JSON.parse(text) as T } catch { return null }
}

function readError(text: string): string {
  const payload = safeJson<{ error?: { message?: string } | string }>(text)
  if (!payload) return ''
  if (typeof payload.error === 'string') return payload.error
  return payload.error?.message ?? ''
}

export type FetchedPage = { title: string; text: string; url: string; truncated: boolean }

export async function fetchPage(url: string, signal?: AbortSignal): Promise<FetchedPage> {
  const target = new URL(url)
  if (!['http:', 'https:'].includes(target.protocol)) throw new Error('只能读取 http 或 https 网页。')
  const transport = isTauri() ? tauriFetch : globalThis.fetch
  let response: Response
  try {
    response = await transport(target.toString(), { method: 'GET', signal })
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : ''
    throw new Error(`网页请求没有成功。${detail ? `原因：${detail}` : '请确认网络连接，或该站点是否允许跨域读取。'}`)
  }
  if (!response.ok) throw new Error(`网页返回了错误状态（${response.status}）。`)
  const html = await response.text()
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '') || target.hostname
  const text = extractText(html)
  const limit = 40_000
  return { title, text: text.slice(0, limit), url: target.toString(), truncated: text.length > limit }
}

function extractText(html: string): string {
  const withoutHead = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
  const blocks = withoutHead
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  return decodeHtml(blocks)
    .split('\n')
    .map(line => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter(line => line.length > 1)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
}

function decodeHtml(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
}
