import { ChevronLeft, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import BlogList from './BlogList';
import MarkdownArticle from './MarkdownArticle';
import NoteEditor from './NoteEditor';
import { blogPosts } from '../lib/blogPosts';
import type { BlogPost } from '../lib/blogPosts';

type BlogViewProps = {
  variant?: 'desktop' | 'mobile';
};

type NotesResponse = {
  notes: BlogPost[];
};

type NoteResponse = {
  note: BlogPost;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof data.message === 'string' ? data.message : '请求失败');
  }

  return data as T;
}

function BlogView({ variant = 'desktop' }: BlogViewProps) {
  const [posts, setPosts] = useState<BlogPost[]>(blogPosts);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(blogPosts[0]?.id ?? '');
  const [mobileMode, setMobileMode] = useState<'list' | 'article' | 'edit'>('list');
  const [editorMode, setEditorMode] = useState<'read' | 'create' | 'edit'>('read');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const isMobile = variant === 'mobile';

  async function loadNotes(preferredId?: string) {
    setIsLoading(true);
    try {
      const data = await requestJson<NotesResponse>('/api/notes');
      setPosts(data.notes);
      setError('');

      const nextSelectedId =
        preferredId && data.notes.some((post) => post.id === preferredId)
          ? preferredId
          : data.notes.some((post) => post.id === selectedId)
            ? selectedId
            : data.notes[0]?.id ?? '';
      setSelectedId(nextSelectedId);
    } catch {
      setError('笔记 API 暂不可用，当前显示构建时的只读内容。');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  const filteredPosts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (keyword.length === 0) {
      return posts;
    }

    return posts.filter((post) => {
      return (
        post.title.toLocaleLowerCase().includes(keyword) ||
        post.date.includes(keyword) ||
        post.content.toLocaleLowerCase().includes(keyword)
      );
    });
  }, [posts, query]);

  const selectedPost =
    filteredPosts.find((post) => post.id === selectedId) ??
    posts.find((post) => post.id === selectedId) ??
    filteredPosts[0] ??
    posts[0];
  const isEditing = editorMode === 'create' || editorMode === 'edit';

  function handleSelectPost(id: string) {
    setSelectedId(id);
    setEditorMode('read');
    if (isMobile) {
      setMobileMode('article');
    }
  }

  function startCreate() {
    setDraftTitle('');
    setDraftContent('');
    setEditorMode('create');
    if (isMobile) {
      setMobileMode('edit');
    }
  }

  function startEdit() {
    if (!selectedPost) {
      return;
    }

    setDraftTitle(selectedPost.title);
    setDraftContent(selectedPost.content);
    setEditorMode('edit');
    if (isMobile) {
      setMobileMode('edit');
    }
  }

  function cancelEditor() {
    setEditorMode('read');
    if (isMobile) {
      setMobileMode(selectedPost ? 'article' : 'list');
    }
  }

  async function saveNote() {
    if (draftTitle.trim().length === 0) {
      setError('标题不能为空。');
      return;
    }

    setIsSaving(true);
    try {
      const payload = JSON.stringify({ title: draftTitle, content: draftContent });
      const data =
        editorMode === 'create'
          ? await requestJson<NoteResponse>('/api/notes', { method: 'POST', body: payload })
          : await requestJson<NoteResponse>(`/api/notes/${encodeURIComponent(selectedPost?.id ?? '')}`, { method: 'PUT', body: payload });

      await loadNotes(data.note.id);
      setSelectedId(data.note.id);
      setEditorMode('read');
      setMobileMode(isMobile ? 'article' : 'list');
      setError('');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败。');
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteSelected() {
    if (!selectedPost) {
      return;
    }

    const confirmed = window.confirm(`确定删除「${selectedPost.title}」吗？`);
    if (!confirmed) {
      return;
    }

    try {
      await requestJson<{ ok: boolean }>(`/api/notes/${encodeURIComponent(selectedPost.id)}`, { method: 'DELETE' });
      const nextPosts = posts.filter((post) => post.id !== selectedPost.id);
      setPosts(nextPosts);
      setSelectedId(nextPosts[0]?.id ?? '');
      setEditorMode('read');
      setMobileMode('list');
      setError('');
      await loadNotes(nextPosts[0]?.id);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败。');
    }
  }

  function renderEmpty() {
    return (
      <section className="markdown-article empty">
        <h2>没有找到笔记</h2>
        <p>新建一篇 Markdown 笔记，或换一个关键词再试。</p>
      </section>
    );
  }

  function renderReader() {
    if (!selectedPost) {
      return renderEmpty();
    }

    return (
      <div className="note-reader-shell">
        <div className="note-reader-actions">
          <button type="button" onClick={startEdit}>
            <Pencil size={15} aria-hidden="true" />
            编辑
          </button>
          <button type="button" onClick={deleteSelected}>
            <Trash2 size={15} aria-hidden="true" />
            删除
          </button>
        </div>
        <MarkdownArticle post={selectedPost} />
      </div>
    );
  }

  function renderEditor() {
    return (
      <NoteEditor
        title={draftTitle}
        content={draftContent}
        isSaving={isSaving}
        mode={editorMode === 'create' ? 'create' : 'edit'}
        onCancel={cancelEditor}
        onContentChange={setDraftContent}
        onSave={() => void saveNote()}
        onTitleChange={setDraftTitle}
      />
    );
  }

  const listPanel = (
    <BlogList
      posts={filteredPosts}
      query={query}
      selectedId={selectedPost?.id ?? selectedId}
      onCreate={startCreate}
      onDeleteSelected={() => void deleteSelected()}
      onEditSelected={startEdit}
      onQueryChange={setQuery}
      onSelect={handleSelectPost}
    />
  );

  if (isMobile && mobileMode === 'article') {
    return (
      <div className="blog-grid mobile-blog-grid article-mode">
        <div className="mobile-detail-header mobile-blog-back">
          <button type="button" onClick={() => setMobileMode('list')}>
            <ChevronLeft size={18} aria-hidden="true" />
            返回笔记
          </button>
          <span>{selectedPost?.readingTime ?? '阅读'}</span>
        </div>
        {error ? <p className="note-status error">{error}</p> : null}
        {renderReader()}
      </div>
    );
  }

  if (isMobile && mobileMode === 'edit') {
    return (
      <div className="blog-grid mobile-blog-grid edit-mode">
        <div className="mobile-detail-header mobile-blog-back">
          <button type="button" onClick={cancelEditor}>
            <ChevronLeft size={18} aria-hidden="true" />
            返回笔记
          </button>
          <span>{editorMode === 'create' ? '新建' : '编辑'}</span>
        </div>
        {error ? <p className="note-status error">{error}</p> : null}
        {renderEditor()}
      </div>
    );
  }

  return (
    <div className={`blog-grid editable-blog-grid ${isMobile ? 'mobile-blog-grid list-mode' : ''}`}>
      {listPanel}
      {!isMobile ? (
        <div className="note-content-column">
          {isLoading ? <p className="note-status">正在同步笔记...</p> : null}
          {error ? <p className="note-status error">{error}</p> : null}
          {isEditing ? renderEditor() : renderReader()}
        </div>
      ) : null}
    </div>
  );
}

export default BlogView;
