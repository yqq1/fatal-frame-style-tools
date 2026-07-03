import { Clipboard, FileCode2, FileJson, FileText, Wand2 } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type NoteMeta = {
  title: string;
  category: string;
  date: string;
  tags: string;
  summary: string;
  slug: string;
};

type Frontmatter = Partial<NoteMeta> & {
  id?: string;
};

type ConversionResult = {
  html: string;
  manifest: string;
  savePath: string;
};

const emptyResult: ConversionResult = {
  html: '',
  manifest: '',
  savePath: '',
};

function getToday() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function stripQuotes(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function parseTags(value: string) {
  return value
    .replace(/^\[/, '')
    .replace(/]$/, '')
    .split(',')
    .map((tag) => stripQuotes(tag).trim())
    .filter(Boolean);
}

function parseFrontmatter(markdown: string): { frontmatter: Frontmatter; body: string } {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    return { frontmatter: {}, body: markdown };
  }

  const frontmatter: Frontmatter = {};
  match[1].split(/\r?\n/).forEach((line) => {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) return;

    const key = field[1].toLowerCase();
    const value = stripQuotes(field[2]);

    if (key === 'title') frontmatter.title = value;
    if (key === 'category') frontmatter.category = value;
    if (key === 'date') frontmatter.date = value;
    if (key === 'summary') frontmatter.summary = value;
    if (key === 'slug') frontmatter.slug = value;
    if (key === 'id') frontmatter.id = value;
    if (key === 'tags') frontmatter.tags = parseTags(value).join(', ');
  });

  return {
    frontmatter,
    body: markdown.slice(match[0].length),
  };
}

function getFirstHeading(markdown: string) {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? '';
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function plainTextFromMarkdown(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[>#*_~|[\]-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createSummary(markdown: string) {
  const text = plainTextFromMarkdown(markdown);
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function formatHtmlFragment(value: string) {
  return value
    .replace(/><(h[1-6]|p|ul|ol|li|blockquote|pre|table|thead|tbody|tr|th|td|hr)/g, '>\n<$1')
    .replace(/<\/(h[1-6]|p|ul|ol|li|blockquote|pre|table|thead|tbody|tr|th|td)>/g, '</$1>\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function markdownToHtml(markdown: string) {
  return formatHtmlFragment(
    renderToStaticMarkup(<ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>)
  );
}

function MarkdownNoteConverter() {
  const [markdown, setMarkdown] = useState('');
  const [meta, setMeta] = useState<NoteMeta>({
    title: '',
    category: 'reverse-engineering',
    date: getToday(),
    tags: '',
    summary: '',
    slug: '',
  });
  const [result, setResult] = useState<ConversionResult>(emptyResult);
  const [message, setMessage] = useState('');
  const dirtyFields = useRef<Partial<Record<keyof NoteMeta, boolean>>>({});

  const parsed = useMemo(() => parseFrontmatter(markdown), [markdown]);

  useEffect(() => {
    const headingTitle = getFirstHeading(parsed.body);
    const frontmatterSlug = parsed.frontmatter.slug || parsed.frontmatter.id || '';

    setMeta((current) => ({
      title: dirtyFields.current.title ? current.title : parsed.frontmatter.title || headingTitle || current.title,
      category: dirtyFields.current.category ? current.category : parsed.frontmatter.category || current.category,
      date: dirtyFields.current.date ? current.date : parsed.frontmatter.date || current.date,
      tags: dirtyFields.current.tags ? current.tags : parsed.frontmatter.tags || current.tags,
      summary: dirtyFields.current.summary ? current.summary : parsed.frontmatter.summary || current.summary,
      slug: dirtyFields.current.slug
        ? current.slug
        : normalizeSlug(frontmatterSlug || parsed.frontmatter.title || headingTitle || current.slug),
    }));
  }, [parsed]);

  function updateMeta(field: keyof NoteMeta, value: string) {
    dirtyFields.current[field] = true;
    setMeta((current) => ({
      ...current,
      [field]: value,
      slug:
        field === 'title' && !dirtyFields.current.slug
          ? normalizeSlug(value)
          : current.slug,
    }));
  }

  function convertMarkdown() {
    const title = meta.title.trim();
    const slug = normalizeSlug(meta.slug || title);

    if (!title || !slug) {
      setMessage('请先填写 title 和 slug/id。');
      return;
    }

    const html = markdownToHtml(parsed.body.trim());
    const savePath = `data/notes/${slug}.html`;
    const article = {
      id: slug,
      title,
      date: meta.date.trim() || getToday(),
      views: 0,
      tags: parseTags(meta.tags),
      summary: meta.summary.trim() || createSummary(parsed.body),
      path: savePath,
    };

    setMeta((current) => ({ ...current, slug }));
    setResult({
      html,
      manifest: JSON.stringify(article, null, 2),
      savePath,
    });
    setMessage(`已生成，目标分类：${meta.category.trim() || '未填写'}`);
  }

  async function copyText(value: string, label: string) {
    if (!value) {
      setMessage('没有可复制的内容。');
      return;
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.append(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setMessage(`${label}已复制。`);
    } catch {
      setMessage(`${label}复制失败。`);
    }
  }

  return (
    <section className="workbench markdown-note-workbench" aria-label="Markdown 笔记转换工作区">
      <div className="viewfinder">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="butterfly markdown-note-butterfly" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className="workbench-head">
        <span className="workbench-icon">
          <FileText size={28} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">文本工具</p>
          <h2>Markdown 笔记转换</h2>
        </div>
      </div>
      <p className="workbench-text">
        粘贴 Markdown，生成可保存到个人主页笔记系统的 HTML 片段和 manifest article JSON。
      </p>

      <div className="markdown-note-layout">
        <div className="markdown-note-panel">
          <div className="markdown-note-panel-head">
            <FileCode2 size={17} aria-hidden="true" />
            <strong>Markdown</strong>
          </div>
          <textarea
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            placeholder="粘贴 Markdown 内容，支持顶部 frontmatter。"
            spellCheck={false}
          />
        </div>

        <div className="markdown-note-panel">
          <div className="markdown-note-panel-head">
            <Wand2 size={17} aria-hidden="true" />
            <strong>元信息</strong>
          </div>
          <div className="markdown-note-meta-grid">
            <label>
              <span>title</span>
              <input value={meta.title} onChange={(event) => updateMeta('title', event.target.value)} />
            </label>
            <label>
              <span>category</span>
              <input value={meta.category} onChange={(event) => updateMeta('category', event.target.value)} />
            </label>
            <label>
              <span>date</span>
              <input type="date" value={meta.date} onChange={(event) => updateMeta('date', event.target.value)} />
            </label>
            <label>
              <span>slug/id</span>
              <input value={meta.slug} onChange={(event) => updateMeta('slug', event.target.value)} />
            </label>
            <label>
              <span>tags</span>
              <input value={meta.tags} onChange={(event) => updateMeta('tags', event.target.value)} placeholder="逆向工程, C" />
            </label>
            <label>
              <span>summary</span>
              <textarea value={meta.summary} onChange={(event) => updateMeta('summary', event.target.value)} />
            </label>
          </div>
          <div className="markdown-note-actions">
            <button type="button" className="primary-action" onClick={convertMarkdown}>
              <Wand2 size={16} aria-hidden="true" />
              转换
            </button>
          </div>
          {message ? <p className="markdown-note-message">{message}</p> : null}
        </div>

        <div className="markdown-note-output markdown-note-output-wide">
          <div className="markdown-note-output-head">
            <strong>HTML 片段</strong>
            <button type="button" onClick={() => void copyText(result.html, 'HTML 片段')}>
              <Clipboard size={15} aria-hidden="true" />
              复制
            </button>
          </div>
          <textarea value={result.html} readOnly spellCheck={false} />
        </div>

        <div className="markdown-note-output">
          <div className="markdown-note-output-head">
            <strong>manifest article JSON</strong>
            <button type="button" onClick={() => void copyText(result.manifest, 'manifest JSON')}>
              <Clipboard size={15} aria-hidden="true" />
              复制
            </button>
          </div>
          <textarea value={result.manifest} readOnly spellCheck={false} />
        </div>

        <div className="markdown-note-output">
          <div className="markdown-note-output-head">
            <strong>推荐保存路径</strong>
            <button type="button" onClick={() => void copyText(result.savePath, '保存路径')}>
              <Clipboard size={15} aria-hidden="true" />
              复制
            </button>
          </div>
          <input value={result.savePath} readOnly />
          <span>插入分类：{meta.category.trim() || '未填写'}</span>
        </div>
      </div>
    </section>
  );
}

export default MarkdownNoteConverter;
