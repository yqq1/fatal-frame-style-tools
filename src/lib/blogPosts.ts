export type BlogPost = {
  id: string;
  title: string;
  date: string;
  slug: string;
  excerpt: string;
  readingTime: string;
  content: string;
};

const modules = import.meta.glob('../content/blog/*.md', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>;

function cleanSlug(value: string) {
  return value.replace(/-/g, ' ').trim();
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[>#*_~|[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePost(path: string, rawContent: string): BlogPost {
  const filename = path.split('/').pop()?.replace(/\.md$/, '') ?? 'note';
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  const date = match?.[1] ?? '';
  const slug = match?.[2] ?? filename;
  const title = rawContent.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? cleanSlug(slug);
  const content = rawContent.replace(/^#\s+.+$/m, '').trim();
  const plainText = stripMarkdown(content);
  const excerpt = plainText.length > 110 ? `${plainText.slice(0, 110)}...` : plainText;
  const readingTime = `${Math.max(1, Math.ceil(plainText.length / 500))} 分钟`;

  return {
    id: filename,
    title,
    date,
    slug,
    excerpt,
    readingTime,
    content,
  };
}

export const blogPosts = Object.entries(modules)
  .map(([path, content]) => parsePost(path, content))
  .sort((a, b) => b.date.localeCompare(a.date));
