import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type NoteEditorProps = {
  title: string;
  content: string;
  isSaving: boolean;
  mode: 'create' | 'edit';
  onCancel: () => void;
  onContentChange: (value: string) => void;
  onSave: () => void;
  onTitleChange: (value: string) => void;
};

function NoteEditor({
  title,
  content,
  isSaving,
  mode,
  onCancel,
  onContentChange,
  onSave,
  onTitleChange,
}: NoteEditorProps) {
  const previewTitle = title.trim() || '未命名笔记';
  const previewContent = content.trim() || '开始编写 Markdown 内容...';

  return (
    <section className="note-editor" data-motion="item" aria-label={mode === 'create' ? '新建笔记' : '编辑笔记'}>
      <div className="note-editor-head">
        <div>
          <p className="eyebrow">{mode === 'create' ? 'new markdown' : 'edit markdown'}</p>
          <h2>{mode === 'create' ? '新建笔记' : '编辑笔记'}</h2>
        </div>
        <div className="note-editor-actions">
          <button type="button" className="ghost-action" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="primary-action" disabled={isSaving} onClick={onSave}>
            {isSaving ? '保存中' : '保存'}
          </button>
        </div>
      </div>

      <div className="note-editor-body">
        <div className="note-editor-form">
          <label>
            <span>标题</span>
            <input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="输入笔记标题" />
          </label>
          <label className="markdown-input">
            <span>Markdown</span>
            <textarea
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="使用 Markdown 记录学习内容"
              spellCheck={false}
            />
          </label>
        </div>

        <article className="markdown-article note-preview">
          <header>
            <p className="eyebrow">preview</p>
            <h2>{previewTitle}</h2>
            <span>实时预览</span>
          </header>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewContent}</ReactMarkdown>
        </article>
      </div>
    </section>
  );
}

export default NoteEditor;
