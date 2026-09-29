import { chatCompletion, type ModelSettings, type RunContext } from './ai'

export type SuggestionDraft = { title: string; detail: string }

/** 从模型输出里宽松地解析 JSON 数组（容忍代码围栏与前后缀文字） */
export function extractJsonArray(text: string): unknown[] {
  const cleaned = text.replace(/```(?:json)?/gi, '```').split('```').find(part => part.trim().startsWith('[')) ?? text
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error('模型没有返回有效的建议列表。')
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as unknown
  if (!Array.isArray(parsed)) throw new Error('模型没有返回有效的建议列表。')
  return parsed
}

function toDrafts(items: unknown[]): SuggestionDraft[] {
  const drafts: SuggestionDraft[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    if (!title) continue
    drafts.push({ title, detail: typeof record.detail === 'string' ? record.detail.trim() : '' })
  }
  return drafts.slice(0, 4)
}

const SUGGESTION_PROMPT = [
  '你是天琴（Lyra）的主动建议引擎。基于用户工作台的当前状态，提出 2 到 4 条现在就值得做的具体行动建议。',
  '要求：每条建议是一个可以直接执行的动作（动词开头，不超过 20 字），detail 用一两句话说明为什么现在做、怎么做。',
  '建议要结合目标、未完成任务、记忆和用户关注的领域；避免空泛的套话；不要重复已经完成的任务。',
  '只输出 JSON 数组，格式：[{"title": "...", "detail": "..."}]，不要输出其他内容。',
].join('\n')

export async function generateSuggestions(
  settings: ModelSettings,
  context: RunContext,
  signal?: AbortSignal,
): Promise<SuggestionDraft[]> {
  const wire = [
    { role: 'system' as const, content: `${SUGGESTION_PROMPT}\n\n工作台状态：\n${renderContext(context)}` },
    { role: 'user' as const, content: '请给出现在的行动建议。' },
  ]
  let text = ''
  await chatCompletion(settings, wire, [], event => {
    if (event.type === 'text') text += event.value
  }, signal)
  return toDrafts(extractJsonArray(text))
}

const BRIEFING_PROMPT = [
  '你是天琴（Lyra）的每日简报撰写者。基于工作台状态与用户关注的领域，写一份简短的中文简报，帮助用户决定今天把精力放在哪里。',
  '结构：第一行是标题「今日简报」；然后 2 到 4 个要点，覆盖：目标推进现状、今天最值得做的一两件事、结合用户关注领域的一条值得留意的信息方向。',
  '总长不超过 300 字，直接给要点，不使用表情符号，不要说空话。',
].join('\n')

export async function generateBriefing(
  settings: ModelSettings,
  context: RunContext,
  signal?: AbortSignal,
): Promise<string> {
  const wire = [
    { role: 'system' as const, content: `${BRIEFING_PROMPT}\n\n工作台状态：\n${renderContext(context)}` },
    { role: 'user' as const, content: '请生成本次简报。' },
  ]
  let text = ''
  await chatCompletion(settings, wire, [], event => {
    if (event.type === 'text') text += event.value
  }, signal)
  const cleaned = text.trim()
  if (!cleaned) throw new Error('模型没有返回简报内容。')
  return cleaned
}

const PLAN_PROMPT = [
  '你是天琴（Lyra）的目标规划助手。针对一个目标，制定 3 到 6 步可执行的推进计划。',
  '要求：每一步以动词开头、有明确产出；步骤之间按时间或依赖关系排序；detail 说明怎么做或完成的标志；贴近工作台现状，不要好高骛远。',
  '只输出 JSON 数组，格式：[{"title": "...", "detail": "..."}]，不要输出其他内容。',
].join('\n')

export async function generatePlan(
  settings: ModelSettings,
  goal: { title: string; why: string },
  context: RunContext,
  signal?: AbortSignal,
): Promise<SuggestionDraft[]> {
  const wire = [
    { role: 'system' as const, content: `${PLAN_PROMPT}\n\n工作台状态：\n${renderContext(context)}` },
    { role: 'user' as const, content: `请为目标「${goal.title}」${goal.why ? `（为什么重要：${goal.why}）` : ''}制定执行计划。` },
  ]
  let text = ''
  await chatCompletion(settings, wire, [], event => {
    if (event.type === 'text') text += event.value
  }, signal)
  const steps: SuggestionDraft[] = []
  for (const item of extractJsonArray(text)) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const title = typeof record.title === 'string' ? record.title.trim() : ''
    if (!title) continue
    steps.push({ title, detail: typeof record.detail === 'string' ? record.detail.trim() : '' })
  }
  if (!steps.length) throw new Error('模型没有返回有效的计划步骤。')
  return steps.slice(0, 6)
}

function renderContext(context: RunContext): string {
  const lines: string[] = []
  lines.push(context.goals.length
    ? context.goals.map(goal => `目标：${goal.title}（${goal.status}，计划 ${goal.planSteps} 步，待办 ${goal.openTasks}）`).join('\n')
    : '目标：暂无')
  lines.push(context.tasks.length
    ? `任务：${context.tasks.slice(0, 20).map(task => `${task.title}${task.done ? '（已完成）' : ''}`).join('；')}`
    : '任务：暂无')
  lines.push(context.memories.length ? `已记住：${context.memories.join('；')}` : '已记住：暂无')
  lines.push(context.fileNames.length ? `资料库文件：${context.fileNames.join('；')}` : '资料库文件：暂无')
  lines.push(context.interests.length ? `用户关注的领域：${context.interests.join('、')}` : '用户关注的领域：暂无')
  return lines.join('\n')
}
