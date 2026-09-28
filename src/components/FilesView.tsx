import { useState } from 'react'
import { FilePlus2, FolderOpen, Trash2, Upload } from 'lucide-react'
import { formatSize, relativeTime, type WorkspaceFile } from '../core'
import { FILE_LABEL } from '../format'

type Props = {
  files: WorkspaceFile[]
  native: boolean
  busy: boolean
  onPick: () => void
  onReadPath: (path: string) => void
  onCreate: (name: string, content: string) => void
  onRemove: (id: string) => void
  onUseInChat: (file: WorkspaceFile) => void
}

export default function FilesView({ files, native, busy, onPick, onReadPath, onCreate, onRemove, onUseInChat }: Props) {
  const [selected, setSelected] = useState<string | null>(files[0]?.id ?? null)
  const [path, setPath] = useState('')
  const [creating, setCreating] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftContent, setDraftContent] = useState('')

  const current = files.find(item => item.id === selected) ?? files[0] ?? null

  const submitCreate = () => {
    if (!draftName.trim() || !draftContent.trim()) return
    onCreate(draftName.trim(), draftContent)
    setDraftName('')
    setDraftContent('')
    setCreating(false)
  }

  return (
    <div className="page files-page">
      <header className="page-head">
        <div>
          <h1>资料</h1>
          <p>把常用文件收进工作台，对话时可以直接引用其中的内容。</p>
        </div>
        <div className="page-actions">
          <button className="ghost-btn" type="button" onClick={() => setCreating(value => !value)}><FilePlus2 size={15} /><span>新建文本</span></button>
          <button className="primary-btn" type="button" onClick={onPick} disabled={busy}><Upload size={15} /><span>添加文件</span></button>
        </div>
      </header>

      {native ? (
        <section className="path-bar">
          <FolderOpen size={16} />
          <input value={path} onChange={event => setPath(event.target.value)} placeholder="也可以直接填写本机文件的绝对路径，例如 D:\notes\plan.md" spellCheck={false} />
          <button className="ghost-btn" type="button" onClick={() => { if (path.trim()) onReadPath(path.trim()) }} disabled={busy}>读取</button>
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
            <button className="primary-btn small" type="button" onClick={submitCreate}>保存到资料</button>
          </div>
        </section>
      ) : null}

      {files.length === 0 ? (
        <section className="empty-state">
          <FilePlus2 size={26} />
          <h2>还没有资料</h2>
          <p>添加第一份文件，工作台就能在对话中引用它的内容。</p>
        </section>
      ) : (
        <div className="files-layout">
          <div className="file-grid">
            {files.map(file => (
              <article key={file.id} className={`file-card${current?.id === file.id ? ' active' : ''}`}>
                <button className="file-card-main" type="button" onClick={() => setSelected(file.id)}>
                  <span className="file-tag">{FILE_LABEL[file.kind]}</span>
                  <strong>{file.name}</strong>
                  <small>{formatSize(file.size)} · {relativeTime(file.createdAt)} · {file.origin}</small>
                </button>
                <div className="file-card-actions">
                  <button className="link-btn" type="button" onClick={() => onUseInChat(file)}>加入对话</button>
                  <button className="icon-btn" type="button" onClick={() => onRemove(file.id)} title="移除这份文件"><Trash2 size={14} /></button>
                </div>
              </article>
            ))}
          </div>

          {current ? (
            <aside className="file-preview">
              <header className="block-head">
                <span>{current.name}</span>
                <em className="count">{current.path}</em>
              </header>
              <pre className="preview-body tall">{current.content.slice(0, 20000)}</pre>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  )
}
