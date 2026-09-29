import { chatCompletion, controlTools, type ModelSettings, type ToolCall, type WireMessage } from './ai'

export type AgentExecutor = (call: ToolCall) => Promise<string>

export type AgentOptions = {
  settings: ModelSettings
  systemPrompt: string
  history: WireMessage[]
  execute: AgentExecutor
  /** 每一轮流式文本回调；参数是本轮的完整累计文本 */
  onText: (roundText: string) => void
  /** 每轮开始时触发，可用于清空上轮文本 */
  onRoundStart?: (round: number) => void
  signal: AbortSignal
  maxRounds?: number
}

/**
 * 多轮智能体循环：模型输出 → 执行工具 → 结果回喂 → 继续，
 * 直到模型给出不再调用工具的最终回答，或达到轮次上限。
 */
export async function runAgent(options: AgentOptions): Promise<string> {
  const { settings, systemPrompt, history, execute, onText, onRoundStart, signal } = options
  const maxRounds = options.maxRounds ?? 6
  const wire: WireMessage[] = [{ role: 'system', content: systemPrompt }, ...history]

  let lastText = ''
  for (let round = 1; round <= maxRounds; round++) {
    onRoundStart?.(round)
    let buffer = ''
    let calls: ToolCall[] = []
    await chatCompletion(settings, wire, controlTools, event => {
      if (event.type === 'text') {
        buffer += event.value
        onText(buffer)
      } else {
        calls = event.value
      }
    }, signal)

    lastText = buffer
    if (!calls.length || round === maxRounds) return lastText

    wire.push({
      role: 'assistant',
      content: buffer || null,
      tool_calls: calls.map(call => ({
        id: call.id,
        type: 'function' as const,
        function: { name: call.name, arguments: call.arguments },
      })),
    })

    for (const call of calls) {
      let result: string
      try {
        result = await execute(call)
      } catch (cause) {
        result = `执行失败：${cause instanceof Error ? cause.message : '未知原因'}`
      }
      wire.push({ role: 'tool', tool_call_id: call.id, content: result })
    }
  }
  return lastText
}
