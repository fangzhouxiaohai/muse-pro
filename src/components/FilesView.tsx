import { useState } from 'react'
import { FileText, FolderOpen, Loader, Plus, Trash2 } from 'lucide-react'
import type { WorkspaceFile, WorkspaceState } from '../core'
import { formatSize } from '../core'
import { FILE_LABEL, relativeTime } from '../format'

type Props = {
  state: WorkspaceState
  native: boolean
  busy: boolean
  onPick: () => void
  onReadPath: (path: string) => void
  onCreate: (name: string, content: string) => void
  onRemove: (id: string) => void
  onUseInChat: (file: WorkspaceFile) => void
}

const ORIGIN_LABEL: Record<WorkspaceFile['origin'], string> = {
  已选择: '已选择',
  模型写入: '模型写入',
  模型生成: '天琴生成',
}

export default function FilesView({ state, native, busy, onPick, onReadPath, onCreate, onRemove, onUseInChat }: Props) {
  const [path, setPath] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftContent, setDraftContent] = useState('')

  const current = state.files.find(item => item.id === selected) ?? state.files[0] ?? null

  const submitCreate = () => {
    if (!draftName.trim() || !draftContent.trim()) return
    onCreate(draftName.trim(), draftContent)
    setDraftName('')
    setDraftContent('')
    setCreating(false)
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>资料库</h1>
          <p>把常用文本收进工作台，天琴在对话中可以直接引用；它生成的文档也会保存在这里。</p>
        </div>
        <div className="page-actions">
          <button className="ghost-btn" type="button" onClick={() => setCreating(value => !value)}><Plus size={15} /><span>新建文本</span></button>
          <button className="primary-btn" type="button" onClick={onPick} disabled={busy}>
            {busy ? <Loader size={15} className="spin" /> : <FolderOpen size={15} />}
            <span>添加文件</span>
          </button>
        </div>
      </header>

      {native ? (
        <section className="path-bar">
          <FolderOpen size={16} />
          <input value={path} onChange={event => setPath(event.target.value)} placeholder="也可以直接填写本机文件的绝对路径，例如 D:\notes\plan.md" spellCheck={false} />
          <button className="ghost-btn small" type="button" onClick={() => { if (path.trim()) onReadPath(path.trim()) }} disabled={busy}>读取</button>
        </section>
      ) : (
        <section className="path-bar disabled">
          <FolderOpen size={16} />
          <span>网页版无法直接读取本机路径，请使用添加文件按钮选择文件。</span>
        </section>
      )}

      {creating ? (
        <section className="create-panel">
          <input value={draftName} onChange={event => setDraftName(event.target.value)} placeholder="文件名，例如 周计划.md" />
          <textarea value={draftContent} onChange={event => setDraftContent(event.target.value)} rows={4} placeholder="文件内容" />
          <div className="quick-actions">
            <button className="ghost-btn small" type="button" onClick={() => setCreating(false)}>取消</button>
            <button className="primary-btn small" type="button" onClick={submitCreate}>保存到资料库</button>
          </div>
        </section>
      ) : null}

      {state.files.length === 0 ? (
        <div className="empty-state">
          <FileText size={28} />
          <h2>还没有资料</h2>
          <p>添加第一份文件，天琴就能在对话中引用它的内容。</p>
        </div>
      ) : (
        <div className="files-layout">
          <div className="file-grid">
            {state.files.map(file => (
              <article key={file.id} className={`file-card${current?.id === file.id ? ' active' : ''}`}>
                <button className="file-card-main" type="button" onClick={() => setSelected(file.id)}>
                  <span className="file-tag">{FILE_LABEL[file.kind]}</span>
                  <strong>{file.name}</strong>
                  <small>{formatSize(file.size)} · {relativeTime(file.createdAt)} · {ORIGIN_LABEL[file.origin]}</small>
                </button>
                <div className="file-card-actions">
                  <button className="link-btn" type="button" onClick={() => onUseInChat(file)}>加入对话</button>
                  <button className="icon-btn" type="button" onClick={() => onRemove(file.id)} title="移除这份资料"><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
          </div>

          {current ? (
            <aside className="file-preview">
              <header className="block-head">
                <span>{current.name}</span>
                <em>{ORIGIN_LABEL[current.origin]} · {formatSize(current.size)}</em>
              </header>
              <pre className="preview-body tall">{current.content.slice(0, 20000) || '（内容没有保存在本地，请重新读取后再使用。）'}</pre>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  )
}
