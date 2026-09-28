import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '@tauri-apps/api/core'

export const MAX_TEXT_FILE = 200_000

export function platformLabel(): string {
  return isTauri() ? '桌面工作空间' : '网页工作空间'
}

export function hasNativeFileAccess(): boolean {
  return isTauri()
}

export async function readTextPath(path: string): Promise<string> {
  if (!isTauri()) throw new Error('网页版无法直接读取本机路径，请点击添加文件按钮选择文件。')
  const content = await invoke<string>('read_text_file', { path })
  if (content.length > MAX_TEXT_FILE) throw new Error('文件超过 200 KB，请先拆分后再加入工作台。')
  return content
}

export async function writeTextPath(path: string, content: string): Promise<string> {
  if (!isTauri()) throw new Error('网页版不能写入本机文件，请在桌面版中执行这个操作。')
  if (content.length > MAX_TEXT_FILE) throw new Error('内容超过 200 KB，请拆分为多个文件后再写入。')
  return await invoke<string>('write_text_file', { path, content })
}

export async function fileExists(path: string): Promise<boolean> {
  if (!isTauri()) return false
  return await invoke<boolean>('file_exists', { path })
}
