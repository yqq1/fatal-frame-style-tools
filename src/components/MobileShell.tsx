import {
  BookOpenText,
  ChevronLeft,
  Film,
  Layers3,
  LibraryBig,
  Music,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminMediaPanel from './AdminMediaPanel';
import BlogView from './BlogView';
import MusicView from './MusicView';
import MuseumView from './MuseumView';
import VideoView from './VideoView';
import type { RuntimeMediaLibraryState } from '../hooks/useRuntimeMediaLibrary';
import type { MobileToolCategory, MobileToolMode, NavKey, ToolCategory, ToolDefinition } from '../types/toolbox';

type MobileShellProps = {
  activeNav: NavKey;
  categoryLabels: Record<ToolCategory, string>;
  mobileToolCategory: MobileToolCategory;
  mobileToolMode: MobileToolMode;
  mediaLibrary: RuntimeMediaLibraryState;
  query: string;
  selectedTool: ToolDefinition;
  tools: ToolDefinition[];
  onMobileToolCategoryChange: (category: MobileToolCategory) => void;
  onMobileToolModeChange: (mode: MobileToolMode) => void;
  onNavChange: (key: NavKey) => void;
  onQueryChange: (value: string) => void;
  onToolSelect: (id: string) => void;
  renderToolCard: (tool: ToolDefinition, selected: boolean, onSelect: () => void) => JSX.Element;
  renderToolWorkbench: (tool: ToolDefinition) => JSX.Element;
};

const bottomNavItems: Array<{
  key: Extract<NavKey, 'all' | 'blog' | 'museum' | 'music' | 'video' | 'settings'>;
  label: string;
  icon: typeof Layers3;
}> = [
  { key: 'all', label: '工具', icon: Layers3 },
  { key: 'blog', label: '笔记', icon: BookOpenText },
  { key: 'museum', label: '资料', icon: LibraryBig },
  { key: 'music', label: '音乐', icon: Music },
  { key: 'video', label: '视频', icon: Film },
  { key: 'settings', label: '设置', icon: Settings },
];

const mobileToolFilters: Array<{ key: MobileToolCategory; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'audio', label: '音频' },
  { key: 'image', label: '图片' },
  { key: 'text', label: '文本' },
];

function getMobileSection(activeNav: NavKey) {
  return activeNav === 'blog' || activeNav === 'museum' || activeNav === 'music' || activeNav === 'video' || activeNav === 'settings' ? activeNav : 'all';
}

function getMobileTitle(section: ReturnType<typeof getMobileSection>, mode: MobileToolMode) {
  if (section === 'blog') {
    return '学习笔记';
  }

  if (section === 'video') {
    return '视频';
  }

  if (section === 'museum') {
    return '资料馆';
  }

  if (section === 'music') {
    return '音乐';
  }

  if (section === 'settings') {
    return '设置';
  }

  return mode === 'detail' ? '工具详情' : '工具箱';
}

function MobileShell({
  activeNav,
  categoryLabels,
  mobileToolCategory,
  mobileToolMode,
  mediaLibrary,
  query,
  selectedTool,
  tools,
  onMobileToolCategoryChange,
  onMobileToolModeChange,
  onNavChange,
  onQueryChange,
  onToolSelect,
  renderToolCard,
  renderToolWorkbench,
}: MobileShellProps) {
  const mobileSection = getMobileSection(activeNav);
  const [isMobilePlayerActive, setIsMobilePlayerActive] = useState(false);
  const title = getMobileTitle(mobileSection, mobileToolMode);
  const filteredTools = tools.filter((tool) => {
    const keyword = query.trim().toLocaleLowerCase();
    const matchesCategory = mobileToolCategory === 'all' || tool.category === mobileToolCategory;
    const matchesQuery =
      keyword.length === 0 ||
      tool.name.toLocaleLowerCase().includes(keyword) ||
      tool.description.toLocaleLowerCase().includes(keyword) ||
      categoryLabels[tool.category].toLocaleLowerCase().includes(keyword);

    return matchesCategory && matchesQuery;
  });

  function handleNavChange(key: NavKey) {
    setIsMobilePlayerActive(false);
    onNavChange(key);
    onMobileToolModeChange('list');
  }

  useEffect(() => {
    setIsMobilePlayerActive(false);
  }, [mobileSection]);

  return (
    <main className={`mobile-shell ${isMobilePlayerActive ? 'mobile-player-active' : ''}`}>
      <div className="grain" />
      <div className="pattern-veil" aria-hidden="true" />

      <section className="mobile-page">
        <header className="mobile-topbar">
          <div className="mobile-brand">
            <span className="brand-mark" aria-hidden="true">
              <span />
            </span>
            <div>
              <p>Crimson Toolbox</p>
              <h1>{title}</h1>
            </div>
          </div>
          <span className="mobile-status">
            <Sparkles size={15} aria-hidden="true" />
            {mobileSection === 'all' ? `${filteredTools.length} 项` : title}
          </span>
        </header>

        <div className="mobile-surface">
          {mobileSection === 'settings' ? (
            <MobileSettings mediaLibrary={mediaLibrary} />
          ) : mobileSection === 'blog' ? (
            <BlogView variant="mobile" />
          ) : mobileSection === 'museum' ? (
            <MuseumView variant="mobile" onOpenMusic={() => handleNavChange('music')} onOpenVideo={() => handleNavChange('video')} />
          ) : mobileSection === 'music' ? (
            <MusicView variant="mobile" onMobilePlayerViewChange={setIsMobilePlayerActive} />
          ) : mobileSection === 'video' ? (
            <VideoView variant="mobile" videos={mediaLibrary.videos} onMobilePlayerViewChange={setIsMobilePlayerActive} />
          ) : mobileToolMode === 'detail' ? (
            <section className="mobile-tool-detail">
              <div className="mobile-detail-header">
                <button type="button" onClick={() => onMobileToolModeChange('list')}>
                  <ChevronLeft size={18} aria-hidden="true" />
                  返回工具
                </button>
                <span>{categoryLabels[selectedTool.category]}</span>
              </div>
              {renderToolWorkbench(selectedTool)}
            </section>
          ) : (
            <section className="mobile-tool-panel" aria-label="工具列表">
              <label className="search-box mobile-search">
                <Search size={18} aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  placeholder="搜索工具"
                  type="search"
                />
              </label>

              <div className="mobile-tool-filters" aria-label="工具分类">
                {mobileToolFilters.map((filter) => (
                  <button
                    className={mobileToolCategory === filter.key ? 'active' : ''}
                    key={filter.key}
                    type="button"
                    onClick={() => onMobileToolCategoryChange(filter.key)}
                  >
                    <SlidersHorizontal size={15} aria-hidden="true" />
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="cards mobile-cards">
                {filteredTools.map((tool) =>
                  renderToolCard(tool, tool.id === selectedTool.id, () => {
                    onToolSelect(tool.id);
                    onMobileToolModeChange('detail');
                  }),
                )}
              </div>
            </section>
          )}
        </div>
      </section>

      <nav className={`mobile-bottom-nav ${isMobilePlayerActive ? 'hidden' : ''}`} aria-label="主要导航">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const active = item.key === mobileSection;

          return (
            <button className={active ? 'active' : ''} key={item.key} type="button" onClick={() => handleNavChange(item.key)}>
              <Icon size={19} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </main>
  );
}

function MobileSettings({ mediaLibrary }: { mediaLibrary: RuntimeMediaLibraryState }) {
  return (
    <section className="settings-panel mobile-settings" aria-label="设置">
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
    </section>
  );
}

export default MobileShell;
