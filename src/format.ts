import type { EventKind, FileKind, GoalStatus, PermissionMode, SuggestionStatus, StepState } from './core'

export const EVENT_LABEL: Record<EventKind, string> = {
  task_created: '新建任务',
  task_updated: '更新任务',
  task_removed: '删除任务',
  goal_created: '创建目标',
  goal_updated: '更新目标',
  goal_removed: '删除目标',
  goal_plan_created: '生成计划',
  memory_saved: '记忆沉淀',
  memory_forgotten: '遗忘记忆',
  suggestion_created: '产生想法',
  suggestion_accepted: '采纳想法',
  suggestion_dismissed: '搁置想法',
  briefing_generated: '生成简报',
  artifact_created: '生成文档',
  file_added: '资料入库',
  file_removed: '资料移除',
  url_opened: '打开网页',
  url_fetched: '读取网页',
  file_read: '读取文件',
  file_written: '写入文件',
  action_failed: '操作失败',
  approval_requested: '请求审批',
  approval_approved: '批准操作',
  approval_rejected: '拒绝操作',
  approval_failed: '审批异常',
  message_sent: '发送消息',
  response_received: '模型回复',
  session_created: '新建对话',
  session_removed: '移除对话',
  settings_updated: '更新设置',
  data_imported: '导入数据',
  data_exported: '导出数据',
}

export const FILE_LABEL: Record<FileKind, string> = {
  text: '文本',
  markdown: '文档',
  json: '数据',
  csv: '表格',
  code: '代码',
  html: '网页',
}

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  active: '推进中',
  paused: '已暂停',
  achieved: '已达成',
}

export const SUGGESTION_LABEL: Record<SuggestionStatus, string> = {
  new: '待处理',
  accepted: '已采纳',
  dismissed: '已搁置',
}

export const PERMISSION_LABEL: Record<PermissionMode, string> = {
  ask: '每次询问',
  auto: '自动批准',
}

export const STEP_LABEL: Record<StepState, string> = {
  running: '进行中',
  done: '已完成',
  pending: '等待中',
  failed: '未完成',
}

export function clockTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

export function dayTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

export function shortHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '')
  } catch {
    return value
  }
}

export function initialOf(title: string): string {
  const trimmed = title.trim()
  return trimmed ? trimmed.slice(0, 1) : '新'
}

export { relativeTime } from './core'
