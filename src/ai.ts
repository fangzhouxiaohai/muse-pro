import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { isTauri } from '@tauri-apps/api/core'
import type { Message } from './core'

export type ModelSettings = { endpoint: string; model: string; apiKey: string }
export type ToolCall = { id: string; name: string; arguments: string }
export type StreamEvent =
  | { type: 'text'; value: string }
  | { type: 'calls'; value: ToolCall[] }

export type RunContext = {
  tasks: { title: string; done: boolean }[]
  goals: { title: string; done: boolean }[]
  fileNames: string[]
}

export const controlTools = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: '在工作台的任务清单中新增一条任务。',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: '任务标题，一句话说明要推进的事项' } },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_goal',
      description: '在工作台的目标清单中新增一条长期目标。',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: '目标标题' } },
        required: ['title'],
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

const SYSTEM_PROMPT = [
  '你是运行在用户本机工作台上的助手，服务于一个人的日常推进：梳理信息、拆解目标、跟进任务、整理资料。',
  '回答使用简体中文，直接给结论和下一步，不要复述用户的话，不要使用表情符号。',
  '你可以调用工具来新增任务和目标，或者提出打开网页、读取网页、读取文件、写入文件的请求。这些请求都必须由用户审批之后才会真正执行。',
  '不要声称已经完成尚未执行的操作。如果一件事需要用户审批，说明你提出了请求并等待确认。',
  '当用户提供的资料足够时，直接给出整理后的结果。当信息不足时，先问一个最关键的问题。',
].join('\n')

export function describeContext(context: RunContext): string {
  const lines: string[] = ['当前工作台状态：']
  lines.push(context.tasks.length ? `任务：${context.tasks.map(item => `${item.title}${item.done ? '（已完成）' : ''}`).join('；')}` : '任务：暂无')
  lines.push(context.goals.length ? `目标：${context.goals.map(item => `${item.title}${item.done ? '（已完成）' : ''}`).join('；')}` : '目标：暂无')
  lines.push(context.fileNames.length ? `已加入工作台的文件：${context.fileNames.join('；')}` : '已加入工作台的文件：暂无')
  return lines.join('\n')
}

function validateEndpoint(endpoint: string): URL {
  const url = new URL(endpoint)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('接口地址必须以 http 或 https 开头。')
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('远程模型接口必须使用 https 地址。')
  return url
}

export async function streamCompletion(
  settings: ModelSettings,
  messages: Message[],
  context: RunContext,
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
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n${describeContext(context)}` },
        ...messages.slice(-24).map(message => ({
          role: message.role === 'system' ? 'user' : message.role,
          content: message.content,
        })),
      ],
      tools: controlTools,
    }),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(readError(text) || `模型接口返回了错误状态（${response.status}）。`)
  }
  if (!response.body) {
    const text = await response.text()
    const payload = safeJson<{ choices?: { message?: { content?: string } }[] }>(text)
    const content = payload?.choices?.[0]?.message?.content
    if (content) onEvent({ type: 'text', value: content })
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
