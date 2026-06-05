import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { BlogPost } from '../lib/blogPosts';

type BlogListProps = {
  posts: BlogPost[];
  query: string;
  selectedId: string;
  onCreate: () => void;
  onDeleteSelected: () => void;
  onEditSelected: () => void;
  onQueryChange: (value: string) => void;
  onSelect: (id: string) => void;
};

function BlogList({
  posts,
  query,
  selectedId,
  onCreate,
  onDeleteSelected,
  onEditSelected,
  onQueryChange,
  onSelect,
}: BlogListProps) {
  const hasSelected = posts.some((post) => post.id === selectedId);

  return (
    <section className="blog-list" aria-label="学习笔记列表">
      <div className="section-heading">
        <div>
          <p className="eyebrow">daily notes</p>
          <h2>学习笔记</h2>
        </div>
        <button type="button" className="note-create-button" onClick={onCreate}>
          <Plus size={15} aria-hidden="true" />
          新建
        </button>
      </div>

      <label className="blog-search">
        <Search size={17} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索标题或正文"
          type="search"
        />
      </label>

      <div className="note-list-toolbar">
        <span>{posts.length} 篇</span>
        <button type="button" disabled={!hasSelected} onClick={onEditSelected}>
          <Pencil size={14} aria-hidden="true" />
          编辑
        </button>
        <button type="button" disabled={!hasSelected} onClick={onDeleteSelected}>
          <Trash2 size={14} aria-hidden="true" />
          删除
        </button>
      </div>

      <div className="blog-post-list">
        {posts.map((post) => (
          <button
            className={`blog-post-card ${post.id === selectedId ? 'selected' : ''}`}
            data-motion="item"
            key={post.id}
            onClick={() => onSelect(post.id)}
          >
            <span>{post.date}</span>
            <strong>{post.title}</strong>
            <em>{post.excerpt}</em>
            <small>{post.readingTime}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export default BlogList;
