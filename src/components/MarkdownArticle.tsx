import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { BlogPost } from '../lib/blogPosts';

function MarkdownArticle({ post }: { post: BlogPost }) {
  return (
    <article className="markdown-article" data-motion="item">
      <header>
        <p className="eyebrow">{post.date}</p>
        <h2>{post.title}</h2>
        <span>{post.readingTime}</span>
      </header>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
    </article>
  );
}

export default MarkdownArticle;
