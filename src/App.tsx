import {
  Archive,
  AudioWaveform,
  BookOpenText,
  Camera,
  ChevronDown,
  ChevronRight,
  Film,
  FileText,
  HardDrive,
  Image,
  LibraryBig,
  Layers3,
  ListChecks,
  Music,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import gsap from 'gsap';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import BlogView from './components/BlogView';
import AdminMediaPanel from './components/AdminMediaPanel';
import DemucsWorkbench from './components/DemucsWorkbench';
import LyricTimingWorkbench from './components/LyricTimingWorkbench';
import MobileShell from './components/MobileShell';
import MuseumView from './components/MuseumView';
import MiniMusicPlayer from './components/MiniMusicPlayer';
import MusicView from './components/MusicView';
import QuizBankWorkbench from './components/QuizBankWorkbench';
import VideoView from './components/VideoView';
import WhisperWorkbench from './components/WhisperWorkbench';
import { SpotlightCard } from './components/ui/SpotlightCard';
import { LyricPictureInPictureProvider } from './context/LyricPictureInPictureContext';
import { MusicPlayerProvider } from './context/MusicPlayerContext';
import { blogPosts } from './lib/blogPosts';
import type { MobileToolCategory, MobileToolMode, NavKey, ToolCategory, ToolDefinition } from './types/toolbox';
import useInterfaceMotion from './hooks/useInterfaceMotion';
import useRuntimeMediaLibrary from './hooks/useRuntimeMediaLibrary';
import type { RuntimeMediaLibraryState } from './hooks/useRuntimeMediaLibrary';
import './styles/museum.css';
import './styles/video.css';
import './App.css';

const categoryLabels: Record<ToolCategory, string> = {
  audio: '音频工具',
  image: '图片工具',
  text: '文本工具',
};

const tools: ToolDefinition[] = [
  {
    id: 'audio-harvester',
    name: 'Whisper 转写',
    category: 'audio',
    description: '选择音频或填写本地路径，生成 Whisper 命令并返回字幕、文本和播放器歌词数据。',
    status: 'ready',
    icon: 'audio',
  },
  {
    id: 'lyric-timing',
    name: '歌词校时',
    category: 'audio',
    description: '预览已导入的生成字幕歌曲，逐行矫正时间点和双语歌词并写回运行时字幕。',
    status: 'ready',
    icon: 'audio',
  },
  {
    id: 'demucs-vocals',
    name: 'Demucs 人声分离',
    category: 'audio',
    description: '本地运行 Demucs 分离 vocals/no_vocals，并把人声文件衔接到 Whisper 转写。',
    status: 'ready',
    icon: 'audio',
  },
  {
    id: 'audio-transcode',
    name: '音频格式转换',
    category: 'audio',
    description: '预留常见音频格式、码率和采样率处理工作区。',
    status: 'planned',
    icon: 'archive',
  },
  {
    id: 'batch-image-edit',
    name: '批量修改图片',
    category: 'image',
    description: '为尺寸调整、压缩、重命名和水印处理准备占位面板。',
    status: 'planned',
    icon: 'image',
  },
  {
    id: 'image-inspector',
    name: '图片信息检查',
    category: 'image',
    description: '预留 EXIF、分辨率、色彩空间和文件体积查看入口。',
    status: 'planned',
    icon: 'camera',
  },
  {
    id: 'quiz-bank',
    name: '题库管理',
    category: 'text',
    description: '结构化维护个人主页刷题 CSV 题库和索引文件。',
    status: 'ready',
    icon: 'quiz',
  },
  {
    id: 'text-cleaner',
    name: '文本清洗',
    category: 'text',
    description: '预留去重、替换、拆分、合并和批量格式化能力。',
    status: 'planned',
    icon: 'text',
  },
  {
    id: 'prompt-notebook',
    name: '片段记录',
    category: 'text',
    description: '为常用文本模板、提示词和处理记录准备空间。',
    status: 'planned',
    icon: 'wand',
  },
];

const navItems: Array<{
  key: NavKey;
  label: string;
  icon: typeof Layers3;
}> = [
  { key: 'all', label: '全部工具', icon: Layers3 },
  { key: 'audio', label: '音频工具', icon: AudioWaveform },
  { key: 'image', label: '图片工具', icon: Image },
  { key: 'text', label: '文本工具', icon: FileText },
  { key: 'blog', label: '学习笔记', icon: BookOpenText },
  { key: 'museum', label: '资料馆', icon: LibraryBig },
  { key: 'music', label: '音乐', icon: Music },
  { key: 'video', label: '视频', icon: Film },
  { key: 'settings', label: '设置', icon: Settings },
];

const toolIcons: Record<ToolDefinition['icon'], typeof AudioWaveform> = {
  archive: Archive,
  audio: AudioWaveform,
  camera: Camera,
  image: Image,
  quiz: ListChecks,
  text: BookOpenText,
  wand: Wand2,
};

const toolCategoryKeys: ToolCategory[] = ['audio', 'image', 'text'];

function isToolCategory(key: NavKey): key is ToolCategory {
  return toolCategoryKeys.includes(key as ToolCategory);
}

function App() {
  const [activeNav, setActiveNav] = useState<NavKey>('all');
  const [selectedToolId, setSelectedToolId] = useState(tools[0].id);
  const [mobileToolCategory, setMobileToolCategory] = useState<MobileToolCategory>('all');
  const [mobileToolMode, setMobileToolMode] = useState<MobileToolMode>('list');
  const [whisperSeedPath, setWhisperSeedPath] = useState('');
  const [query, setQuery] = useState('');
  const mediaLibrary = useRuntimeMediaLibrary();
  const shellRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);

  const selectedTool = tools.find((tool) => tool.id === selectedToolId) ?? tools[0];

  const filteredTools = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    return tools.filter((tool) => {
      const matchesNav =
        activeNav === 'all' ||
        activeNav === 'settings' ||
        activeNav === 'blog' ||
        activeNav === 'museum' ||
        activeNav === 'video' ||
        tool.category === activeNav;
      const matchesQuery =
        keyword.length === 0 ||
        tool.name.toLocaleLowerCase().includes(keyword) ||
        tool.description.toLocaleLowerCase().includes(keyword) ||
        categoryLabels[tool.category].toLocaleLowerCase().includes(keyword);
      return matchesNav && matchesQuery;
    });
  }, [activeNav, query]);

  const showSettings = activeNav === 'settings';
  const showBlog = activeNav === 'blog';
  const showMuseum = activeNav === 'museum';
  const showMusic = activeNav === 'music';
  const showVideo = activeNav === 'video';
  const showTools = !showSettings && !showBlog && !showMuseum && !showMusic && !showVideo;
  const topbarTitle = showMuseum ? '零系列资料馆' : showMusic ? '音乐播放器' : showVideo ? '视频播放器' : showBlog ? '学习笔记' : showSettings ? '设置' : '集成工具箱';
  const topbarEyebrow = showVideo
    ? 'prepared video shelf'
    : showMusic
      ? 'prepared music shelf'
      : showMuseum
        ? 'fatal frame archive'
        : showBlog
          ? 'daily markdown journal'
          : showSettings
            ? 'configuration'
            : 'night archive console';
  const statusText = showVideo
    ? `${mediaLibrary.videos.length} 个视频`
    : showMusic
      ? `${mediaLibrary.musicTracks.length} 首音乐`
      : showMuseum
        ? '作品与游玩记录'
        : showBlog
          ? `${blogPosts.length} 篇笔记`
          : showSettings
            ? '偏好配置'
            : `${tools.length} 个入口`;
  useInterfaceMotion(workspaceRef, [activeNav]);

  function selectFirstToolInCategory(category: ToolCategory) {
    const nextTool = tools.find((tool) => tool.category === category);
    if (nextTool) {
      setSelectedToolId(nextTool.id);
    }
  }

  function handleNavChange(key: NavKey) {
    setActiveNav(key);
    if (isToolCategory(key)) {
      selectFirstToolInCategory(key);
    }
  }

  function handleMobileToolCategoryChange(category: MobileToolCategory) {
    setMobileToolCategory(category);
    if (category !== 'all') {
      selectFirstToolInCategory(category);
    }
  }

  function useDemucsOutputInWhisper(path: string) {
    setWhisperSeedPath(path);
    setSelectedToolId('audio-harvester');
    setActiveNav('audio');
    setMobileToolCategory('audio');
    setMobileToolMode('detail');
  }

  return (
    <MusicPlayerProvider tracks={mediaLibrary.musicTracks}>
    <LyricPictureInPictureProvider>
    <main className="shell desktop-shell" ref={shellRef}>
      <div className="grain" />
      <div className="pattern-veil" aria-hidden="true" />
      <div className="image-veil" aria-hidden="true" />
      <aside className="sidebar" aria-label="工具分类">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <div>
            <p>Crimson Toolbox</p>
            <strong>工具箱</strong>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`nav-item ${activeNav === item.key ? 'active' : ''}`}
                key={item.key}
                aria-pressed={activeNav === item.key}
                onClick={() => handleNavChange(item.key)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            );
          })}
        </nav>

      </aside>

      <section className="workspace" ref={workspaceRef}>
        <header className="topbar" data-motion="topbar">
          <div>
            <p className="eyebrow">{topbarEyebrow}</p>
            <h1>{topbarTitle}</h1>
          </div>
          {showTools ? (
            <label className="search-box">
              <Search size={18} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索工具"
                type="search"
              />
            </label>
          ) : (
            <div className="topbar-quiet">
              {showMuseum ? '本地资料与进度' : showMusic ? '本地静态音乐' : showVideo ? '本地静态视频' : showBlog ? 'Markdown 只读笔记' : '基础配置占位'}
            </div>
          )}
          {showTools ? (
            <TopbarToolSwitcher tools={filteredTools} selectedTool={selectedTool} onSelect={setSelectedToolId} />
          ) : (
            <div className="status-pill">
              <Sparkles size={16} aria-hidden="true" />
              <span>{statusText}</span>
            </div>
          )}
        </header>

        <div className="page-surface" data-motion="panel">
          {showSettings ? (
            <SettingsPanel mediaLibrary={mediaLibrary} />
          ) : showBlog ? (
            <BlogView />
          ) : showMuseum ? (
            <MuseumView onOpenMusic={() => setActiveNav('music')} onOpenVideo={() => setActiveNav('video')} />
          ) : showMusic ? (
            <MusicView />
          ) : showVideo ? (
            <VideoView videos={mediaLibrary.videos} />
          ) : (
            <div className={`home-dashboard ${['audio-harvester', 'lyric-timing', 'demucs-vocals', 'quiz-bank'].includes(selectedTool.id) ? 'home-dashboard-tool-active' : ''}`}>
              <ToolWorkbench tool={selectedTool} onUseWhisperInput={useDemucsOutputInWhisper} whisperSeedPath={whisperSeedPath} />
            </div>
          )}
        </div>
      </section>
    </main>
    <MobileShell
      activeNav={activeNav}
      categoryLabels={categoryLabels}
      mobileToolCategory={mobileToolCategory}
      mobileToolMode={mobileToolMode}
      query={query}
      selectedTool={selectedTool}
      tools={tools}
      onMobileToolCategoryChange={handleMobileToolCategoryChange}
      onMobileToolModeChange={setMobileToolMode}
      onNavChange={handleNavChange}
      onQueryChange={setQuery}
      onToolSelect={setSelectedToolId}
      renderToolCard={(tool, selected, onSelect) => (
        <ToolCard key={tool.id} selected={selected} tool={tool} onSelect={onSelect} />
      )}
      renderToolWorkbench={(tool) => <ToolWorkbench tool={tool} onUseWhisperInput={useDemucsOutputInWhisper} whisperSeedPath={whisperSeedPath} />}
      mediaLibrary={mediaLibrary}
    />
    <MiniMusicPlayer
      onOpenMusic={() => {
        setActiveNav('music');
        setMobileToolMode('list');
      }}
    />
    </LyricPictureInPictureProvider>
    </MusicPlayerProvider>
  );
}

function ToolCard({
  tool,
  selected,
  onSelect,
}: {
  tool: ToolDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = toolIcons[tool.icon];

  return (
    <SpotlightCard
      className={`tool-card ${selected ? 'selected' : ''}`}
      data-motion="item"
      aria-pressed={selected}
      spotlightColor="oklch(64% 0.16 25 / 0.24)"
      onClick={onSelect}
    >
      <span className="tool-icon">
        <Icon size={22} aria-hidden="true" />
      </span>
      <span className="tool-copy">
        <strong>{tool.name}</strong>
        <span>{tool.description}</span>
      </span>
      <span className="tool-meta">{categoryLabels[tool.category]}</span>
    </SpotlightCard>
  );
}

function TopbarToolSwitcher({
  onSelect,
  selectedTool,
  tools,
}: {
  onSelect: (toolId: string) => void;
  selectedTool: ToolDefinition;
  tools: ToolDefinition[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const SelectedIcon = toolIcons[selectedTool.icon];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    function handlePointerDown(event: Event) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function selectTool(toolId: string) {
    onSelect(toolId);
    setIsOpen(false);
  }

  return (
    <div className={`topbar-tool-switcher ${isOpen ? 'open' : ''}`}>
      <button
        className="topbar-tool-trigger"
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="topbar-tool-icon">
          <SelectedIcon size={17} aria-hidden="true" />
        </span>
        <span className="topbar-tool-copy">
          <strong>{selectedTool.name}</strong>
          <span>{categoryLabels[selectedTool.category]} · {tools.length} 项</span>
        </span>
        <ChevronDown className="topbar-tool-chevron" size={16} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="topbar-tool-menu" ref={menuRef} role="menu" aria-label="选择工具">
          {tools.length > 0 ? (
            tools.map((tool) => {
              const Icon = toolIcons[tool.icon];
              const selected = tool.id === selectedTool.id;
              return (
                <button
                  className={`topbar-tool-option ${selected ? 'active' : ''}`}
                  key={tool.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  onClick={() => selectTool(tool.id)}
                >
                  <span className="topbar-tool-icon">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <span className="topbar-tool-option-copy">
                    <strong>{tool.name}</strong>
                    <span>{tool.description}</span>
                  </span>
                  <span className="topbar-tool-option-meta">{categoryLabels[tool.category]}</span>
                </button>
              );
            })
          ) : (
            <div className="topbar-tool-empty" role="status">无匹配工具</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ToolWorkbench({
  onUseWhisperInput,
  tool,
  whisperSeedPath,
}: {
  onUseWhisperInput: (path: string) => void;
  tool: ToolDefinition;
  whisperSeedPath: string;
}) {
  const Icon = toolIcons[tool.icon];

  if (tool.id === 'audio-harvester') {
    return <WhisperWorkbench prefillInputPath={whisperSeedPath} />;
  }

  if (tool.id === 'lyric-timing') {
    return <LyricTimingWorkbench />;
  }

  if (tool.id === 'demucs-vocals') {
    return <DemucsWorkbench onUseWhisperInput={onUseWhisperInput} />;
  }

  if (tool.id === 'quiz-bank') {
    return <QuizBankWorkbench />;
  }

  return (
    <section className="workbench" aria-label="工具工作区">
      <div className="viewfinder">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="butterfly" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="workbench-head">
        <span className="workbench-icon">
          <Icon size={30} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">{categoryLabels[tool.category]}</p>
          <h2>{tool.name}</h2>
        </div>
      </div>
      <p className="workbench-text">{tool.description}</p>
      <div className="placeholder-panel">
        <div>
          <strong>待接入功能</strong>
          <span>后续在这里放上传、参数、执行队列和结果输出。</span>
        </div>
      </div>
      <div className="workbench-actions">
        <button disabled>开始处理</button>
        <button disabled>导入文件</button>
      </div>
    </section>
  );
}

type CleanupDirectorySummary = {
  key: string;
  label: string;
  path: string;
  fileCount: number;
  totalSize: number;
  expiredFileCount: number;
  expiredSize: number;
  protectedFileCount: number;
};

type CleanupSummary = {
  ttlHours: number;
  maxSize: number;
  totalFileCount: number;
  totalSize: number;
  expiredFileCount: number;
  expiredSize: number;
  needsCleanup: boolean;
  directories: CleanupDirectorySummary[];
};

type CleanupResult = {
  deletedCount: number;
  freedSize: number;
  finishedAt: string;
  summary: CleanupSummary;
};

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function formatStorageBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const digits = size >= 10 || unitIndex === 0 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unitIndex]}`;
}

function StorageCleanupPanel() {
  const [summary, setSummary] = useState<CleanupSummary | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const usagePercent = summary ? Math.min(100, Math.round((summary.totalSize / summary.maxSize) * 100)) : 0;

  async function loadSummary() {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/storage/cleanup');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '无法读取临时文件统计。');
      }

      setSummary(data.summary);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法读取临时文件统计。');
    } finally {
      setIsLoading(false);
    }
  }

  async function runCleanup() {
    setIsCleaning(true);
    setMessage('');

    try {
      const response = await fetch('/api/storage/cleanup', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '临时文件清理失败。');
      }

      setCleanupResult(data.cleanup);
      setSummary(data.cleanup.summary);
      setMessage(`已清空 ${data.cleanup.deletedCount} 个临时文件，释放 ${formatStorageBytes(data.cleanup.freedSize)}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '临时文件清理失败。');
    } finally {
      setIsCleaning(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll('[data-cleanup-motion]'),
        { y: 12, autoAlpha: 0, scale: 0.99 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.36, ease: 'power3.out', stagger: 0.05, clearProps: 'transform,visibility' },
      );
    }, root);

    return () => context.revert();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !cleanupResult || prefersReducedMotion()) {
      return;
    }

    const target = root.querySelector('.cleanup-result-card');
    if (!target) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        target,
        { y: 8, autoAlpha: 0, scale: 0.98 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.28, ease: 'power2.out', clearProps: 'transform,visibility' },
      );
    }, root);

    return () => context.revert();
  }, [cleanupResult?.finishedAt]);

  return (
    <div className="storage-cleanup-panel" ref={rootRef}>
      <div className="storage-cleanup-head" data-cleanup-motion>
        <span className="storage-cleanup-icon">
          <HardDrive size={22} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">managed temporary storage</p>
          <h3>临时文件清理</h3>
          <p className="cleanup-subtitle">自动清理只处理过期或超容量文件；手动按钮会清空所有未被运行任务保护的临时文件。</p>
        </div>
        <span className={`cleanup-status ${summary?.needsCleanup ? 'warning' : 'stable'}`}>
          {summary?.needsCleanup ? '需要清理' : '容量稳定'}
        </span>
      </div>

      <div className="cleanup-overview" data-cleanup-motion>
        <div>
          <span>当前占用</span>
          <strong>{summary ? formatStorageBytes(summary.totalSize) : '--'}</strong>
        </div>
        <div>
          <span>空间上限</span>
          <strong>{summary ? formatStorageBytes(summary.maxSize) : '3 GB'}</strong>
        </div>
        <div>
          <span>过期策略</span>
          <strong>{summary ? `${summary.ttlHours} 小时` : '48 小时'}</strong>
        </div>
      </div>

      <div className="cleanup-meter" data-cleanup-motion aria-label="临时文件容量占用">
        <span style={{ width: `${usagePercent}%` }} />
      </div>

      <div className="cleanup-directory-grid" data-cleanup-motion>
        {(summary?.directories ?? []).map((directory) => (
          <article className="cleanup-directory-card" key={directory.key}>
            <div>
              <strong>{directory.label}</strong>
              <span>{directory.path}</span>
            </div>
            <dl>
              <div>
                <dt>文件</dt>
                <dd>{directory.fileCount}</dd>
              </div>
              <div>
                <dt>占用</dt>
                <dd>{formatStorageBytes(directory.totalSize)}</dd>
              </div>
              <div>
                <dt>过期</dt>
                <dd>{formatStorageBytes(directory.expiredSize)}</dd>
              </div>
              <div>
                <dt>保护</dt>
                <dd>{directory.protectedFileCount}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      {cleanupResult ? (
        <div className="cleanup-result-card" data-cleanup-motion>
          <ShieldCheck size={18} aria-hidden="true" />
          <span>清空 {cleanupResult.deletedCount} 个临时文件，释放 {formatStorageBytes(cleanupResult.freedSize)}</span>
        </div>
      ) : null}

      {message ? <p className="cleanup-message" data-cleanup-motion>{message}</p> : null}

      <div className="cleanup-actions" data-cleanup-motion>
        <button type="button" onClick={loadSummary} disabled={isLoading || isCleaning}>
          <RefreshCw className={isLoading ? 'spinning' : ''} size={16} aria-hidden="true" />
          刷新统计
        </button>
        <button className="danger" type="button" onClick={runCleanup} disabled={isLoading || isCleaning || !summary}>
          <Trash2 size={16} aria-hidden="true" />
          {isCleaning ? '清空中' : '清空临时文件'}
        </button>
      </div>
    </div>
  );
}

function SettingsPanel({ mediaLibrary }: { mediaLibrary: RuntimeMediaLibraryState }) {
  return (
    <section className="settings-panel" aria-label="设置">
      <div className="section-heading">
        <div>
          <p className="eyebrow">configuration</p>
          <h2>设置</h2>
        </div>
      </div>
      <div className="setting-list">
        <div>
          <strong>默认输出目录</strong>
          <span>等待后续工具功能接入后配置。</span>
        </div>
        <div>
          <strong>任务记录</strong>
          <span>预留执行历史、失败重试和日志入口。</span>
        </div>
        <div>
          <strong>界面主题</strong>
          <span>当前使用暗红旧宅与红蝶主题。</span>
        </div>
      </div>
      <AdminMediaPanel
        runtimeAudioTracks={mediaLibrary.runtimeAudioTracks}
        runtimeVideos={mediaLibrary.runtimeVideos}
        onLibraryChange={mediaLibrary.refresh}
      />
      <StorageCleanupPanel />
    </section>
  );
}

export default App;
