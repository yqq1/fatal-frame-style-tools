# Design Token 规范

来源：`src/index.css`、`src/App.css`。当前项目未集中定义 token，本文件抽取当前页面实际样式，用于后续页面复用。

## 复用规则

- 新页面优先复用本文 token，不另起一套颜色、圆角、阴影或字体。
- 保持暗红、旧宅、红蝶、取景框、仪式感播放器风格。
- 普通卡片圆角使用 `8px`；按钮和输入框使用 `7px`；pill/圆形控件使用 `999px`。
- hover/focus 以红色细边框、内光、`translateY(-1px)` 为主，避免大幅动效。
- 移动端断点沿用 `@media (max-width: 760px)`，最小可用宽度为 `320px`。

## 1. 颜色体系

### 品牌主色

| Token | 色值 | 使用场景 |
|---|---:|---|
| `brand.crimson.focus` | `oklch(66% 0.14 28)` | 全局键盘焦点 outline |
| `brand.crimson.primary` | `oklch(59% 0.16 28)` | 视频/音频 range accent |
| `brand.crimson.hot` | `oklch(64% 0.17 35)` | 进度条起始渐变 |
| `brand.crimson.deep` | `oklch(54% 0.18 25)` | 进度条结束渐变 |
| `brand.crimson.glow` | `oklch(43% 0.12 25 / 0.26)` | Logo、红蝶发光 |
| `brand.gold.text` | `oklch(67% 0.035 58)` | 英文 eyebrow、品牌小字 |
| `brand.ritual.icon` | `oklch(79% 0.07 30)` | 工具图标、仪式感控件 |

### 功能辅助色

| Token | 色值 | 使用场景 |
|---|---:|---|
| `success.border` | `oklch(55% 0.075 86 / 0.55)` | `.cleanup-status.stable` 边框 |
| `success.text` | `oklch(78% 0.07 86)` | 稳定状态文本 |
| `warning.border` | `oklch(62% 0.15 31 / 0.68)` | `.cleanup-status.warning` 边框 |
| `warning.text` | `oklch(86% 0.11 38)` | 警告状态文本 |
| `warning.bg` | `oklch(31% 0.09 27 / 0.54)` | 警告状态背景 |
| `error.border` | `oklch(52% 0.11 25 / 0.66)` | 视频/音乐错误框边框 |
| `error.title` | `oklch(94% 0.055 35)` | 错误标题 |
| `error.bg` | `oklch(14% 0.03 24 / 0.88)` | 视频错误背景 |
| `note.error.border` | `oklch(55% 0.13 26 / 0.42)` | 笔记错误提示边框 |
| `note.error.bg` | `oklch(16% 0.032 27 / 0.78)` | 笔记错误提示背景 |

### 中性色

| Token | 色值 | 使用场景 |
|---|---:|---|
| `bg.root` | `oklch(13% 0.012 28)` | 根背景 |
| `bg.shell.dark` | `oklch(9% 0.01 24)` | 页面深色背景 |
| `bg.surface` | `oklch(15% 0.014 32 / 0.84)` | 通用卡片/面板底色 |
| `bg.panel` | `oklch(18% 0.016 34 / 0.88)` | 工作台背景 |
| `bg.input` | `oklch(16% 0.014 30 / 0.78)` | 搜索框背景 |
| `text.root` | `oklch(91% 0.012 48)` | 全局文本 |
| `text.heading` | `oklch(96% 0.012 57)` | 一级标题 |
| `text.strong` | `oklch(94% 0.014 56)` | 卡片标题、强文本 |
| `text.body` | `oklch(85% 0.018 56)` | Markdown 正文 |
| `text.secondary` | `oklch(70% 0.025 55)` | 描述文本 |
| `text.muted` | `oklch(64% 0.032 50)` | 日期、辅助说明 |
| `text.placeholder` | `oklch(61% 0.025 48)` | input placeholder |
| `line.default` | `oklch(46% 0.052 42 / 0.48)` | 通用面板边框 |
| `line.subtle` | `oklch(43% 0.05 42 / 0.5)` | 分割线、表单边框 |

## 2. 字体系统

| Token | 字体栈 | 使用场景 |
|---|---|---|
| `font.body` | `"Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif` | 全局 UI |
| `font.display` | `"Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, SimSun, serif` | 标题、品牌、卡片标题 |
| `font.ritual` | `KaiTi, STKaiti, "Kaiti SC", "FangSong", "Noto Serif SC", "Songti SC", serif` | 视频/音乐标题、歌词氛围 |
| `font.latin` | `Georgia, "Times New Roman", serif` | 英文 eyebrow、编号 |
| `font.mono` | `"Cascadia Code", "SFMono-Regular", Consolas, monospace` | Markdown 编辑器、代码块 |

| 层级 | 字号 | 字重 | 行高 | 使用场景 |
|---|---:|---:|---:|---|
| `heading.h1` | `1.9rem` | `800` | `1.12` | 桌面页面主标题 |
| `heading.h2` | `1.24rem` | `800` | `1.18` | 模块标题 |
| `mobile.brand.h1` | `1.46rem` | 继承 h1 | 继承 h1 | 移动端顶部标题 |
| `markdown.h1` | `1.52rem` | 继承 | 默认 | Markdown 一级标题 |
| `markdown.h2` | `1.24rem` | 继承 | 默认 | Markdown 二级标题 |
| `markdown.h3` | `1.08rem` | 继承 | 默认 | Markdown 三级标题 |
| `markdown.body` | `0.96rem` 移动端 | 默认 | `1.72` | Markdown 正文 |
| `tool.desc` | `0.83rem` | 默认 | `1.38` | 工具卡片描述 |
| `card.meta` | `0.78rem` | `800` | 默认 | 日期、数量、状态 |
| `video.title` | `clamp(2.8rem, 4.6vw, 4.2rem)` | `800` | `0.92` | 桌面视频标题 |
| `music.title` | `clamp(2.35rem, 4.6vw, 4.3rem)` | `800` | `0.98` | 桌面音乐标题 |
| `mobile.video.title` | `1.72rem` | 继承 | `1.1` | 移动端视频标题 |
| `editor.mono` | `0.9rem` | 默认 | `1.62` | Markdown textarea |

## 3. 间距系统

| Token | 数值 | 使用场景 |
|---|---:|---|
| `space.2` | `2px` | 控件微间距 |
| `space.3` | `3px` | 移动端视频按钮 gap |
| `space.4` | `4px` | 小型按钮/状态内部 gap |
| `space.5` | `5px` | 列表项内部 gap |
| `space.6` | `6px` | 按钮图标间距 |
| `space.7` | `7px` | 表单 label gap |
| `space.8` | `8px` | 常用组件 gap、按钮组 |
| `space.10` | `10px` | 卡片列表 gap、操作按钮 gap |
| `space.12` | `12px` | 常用内边距、移动端 topbar gap |
| `space.14` | `14px` | 卡片 gap、移动端 surface gap |
| `space.16` | `16px` | 移动端页面基础内边距 |
| `space.18` | `18px` | 笔记/设置面板 padding |
| `space.22` | `22px` | 桌面模块 gap 下限 |
| `space.26` | `26px` | 工具列表、Markdown padding |
| `space.34` | `34px` | 工作台 padding、桌面边距下限 |
| `space.58` | `58px` | 桌面 workspace padding 上限 |

关键布局间距：

```css
workspace.padding: clamp(34px, 3.6vw, 58px);
topbar.gap: clamp(22px, 2.4vw, 38px);
topbar.margin-bottom: clamp(38px, 4.6vh, 56px);
mobile-shell.padding: 16px 14px calc(92px + env(safe-area-inset-bottom));
mobile-page.gap: 16px;
mobile-surface.gap: 14px;
```

## 4. 圆角与阴影

### 圆角

| Token | 数值 | 使用场景 |
|---|---:|---|
| `radius.code` | `5px` | Markdown inline code |
| `radius.small` | `6px` | 音乐列表项、菜单项 |
| `radius.base` | `7px` | 输入框、普通按钮、导航项 |
| `radius.card` | `8px` | 卡片、工作台、播放器面板 |
| `radius.popover` | `9px` | 清晰度菜单、状态卡 |
| `radius.mobile-nav` | `10px` | 移动端底部导航、音量浮层 |
| `radius.panel-large` | `11px` | 存储清理面板 |
| `radius.pill` | `999px` | 标签、圆形按钮、进度条 |

### 阴影

| Token | 数值 | 使用场景 |
|---|---|---|
| `shadow.surface` | `0 24px 80px oklch(3% 0.01 20 / 0.38)` | 桌面通用卡片 |
| `shadow.mobile-surface` | `0 14px 44px oklch(3% 0.01 20 / 0.28)` | 移动端卡片 |
| `shadow.mobile-nav` | `0 18px 54px oklch(3% 0.01 20 / 0.58), inset 0 1px 0 oklch(88% 0.02 55 / 0.05)` | 移动端底部导航 |
| `shadow.focus-search` | `inset 0 0 22px oklch(45% 0.14 25 / 0.2), 0 0 0 1px oklch(58% 0.12 28 / 0.2), 0 0 28px oklch(38% 0.12 24 / 0.16)` | 搜索框 focus |
| `shadow.menu` | `inset 0 1px 0 oklch(88% 0.035 56 / 0.06), 0 14px 36px oklch(2% 0.01 24 / 0.54)` | 清晰度菜单 |
| `shadow.music-panel` | `inset 0 1px 0 oklch(88% 0.02 55 / 0.05), 0 16px 42px oklch(3% 0.01 20 / 0.38)` | 音乐控制面板 |

## 5. 通用组件样式

### 主按钮

```css
min-height: 34px;
padding: 0 11px;
border: 1px solid oklch(60% 0.14 28 / 0.5);
border-radius: 7px;
color: oklch(85% 0.022 55);
background:
  radial-gradient(circle at 20% 50%, oklch(54% 0.16 27 / 0.18), transparent 62%),
  oklch(20% 0.036 29 / 0.88);
font-weight: 800;
```

Hover：

```css
transform: translateY(-1px);
border-color: oklch(58% 0.11 27 / 0.62);
color: oklch(96% 0.016 56);
background: oklch(21% 0.032 29 / 0.88);
```

### 次按钮

```css
min-height: 34px;
padding: 0 11px;
border: 1px solid oklch(48% 0.06 36 / 0.5);
border-radius: 7px;
color: oklch(85% 0.022 55);
background: oklch(15% 0.018 29 / 0.78);
font-weight: 800;
```

### 卡片

```css
border: 1px solid oklch(46% 0.052 42 / 0.48);
border-radius: 8px;
background:
  linear-gradient(180deg, oklch(20% 0.02 34 / 0.58), transparent 38%),
  radial-gradient(circle at 100% 0%, oklch(54% 0.045 235 / 0.09), transparent 18rem),
  oklch(15% 0.014 32 / 0.84);
box-shadow: 0 24px 80px oklch(3% 0.01 20 / 0.38);
```

### 输入框 / 搜索框

```css
height: 42px;
padding: 0 13px;
gap: 10px;
border: 1px solid oklch(45% 0.05 42 / 0.5);
border-radius: 7px;
background: oklch(16% 0.014 30 / 0.78);
color: oklch(69% 0.03 50);
```

### 多行文本框 / 选择控件

- 所有 `textarea` 默认禁止显示原生滚动条和右下角 resize 控件，用户通过鼠标滚轮、触控板或触摸滑动滚动内容。
- `textarea` 默认使用 `resize: none; scrollbar-width: none;`，并隐藏 `::-webkit-scrollbar`。
- 除非用户明确要求可拖拽调整高度，否则禁止使用 `resize: vertical`。
- 下拉选择控件不得使用系统原生白色样式，优先复用项目主题化选择组件。

```css
resize: none;
scrollbar-width: none;
```

### 标签 / 状态 Pill

```css
min-height: 32px;
padding: 0 11px;
gap: 7px;
border: 1px solid oklch(53% 0.088 24 / 0.46);
border-radius: 999px;
color: oklch(87% 0.035 42);
background: oklch(23% 0.035 28 / 0.7);
font-size: 0.82rem;
```

### 播放器圆形控件

```css
width: 42px;
height: 42px;
min-width: 42px;
border: 1px solid oklch(46% 0.055 42 / 0.5);
border-radius: 999px;
color: oklch(82% 0.03 52);
background:
  radial-gradient(circle at 50% 0%, oklch(62% 0.11 28 / 0.12), transparent 72%),
  oklch(15% 0.016 30 / 0.8);
```

## 6. 布局规则

| 场景 | 规则 |
|---|---|
| 桌面 App Shell | `grid-template-columns: 220px minmax(0, 1fr)` |
| 桌面页面宽度 | `width: min(100%, 1440px)` |
| 桌面 workspace | `height: 100vh; overflow: hidden; padding: clamp(34px, 3.6vw, 58px)` |
| 顶部栏 | `grid-template-columns: minmax(190px, 1fr) minmax(220px, 360px) auto` |
| 工具首页 | `minmax(300px, 0.36fr) minmax(700px, 1fr)` |
| 博客页 | `minmax(300px, 0.82fr) minmax(440px, 1.5fr)` |
| 视频页 | `minmax(520px, 1.48fr) minmax(270px, 0.52fr)` |
| 音乐页 | `minmax(480px, 1.2fr) minmax(280px, 0.72fr)` |
| 移动端断点 | `@media (max-width: 760px)` |
| 移动端页面宽度 | `width: min(100%, 480px)` |
| 移动端底部导航 | fixed，`left/right: 12px`，`width: min(calc(100% - 24px), 480px)` |
| 移动端底部安全区 | `padding-bottom: calc(92px + env(safe-area-inset-bottom))` |
| 最小设备宽度 | `body { min-width: 320px; }` |

## 7. 页面主题样式

- 主背景使用多层 `radial-gradient` + `linear-gradient`，主体色为 `oklch(12% 0.012 30)`、`oklch(15% 0.018 48)`、`oklch(9% 0.01 22)`。
- 装饰资源：`./assets/crimson-butterfly-real.png`、`./assets/toolbox-atmosphere.png`。
- `.grain` 使用 `38px 38px` 网格，透明度 `0.22`。
- `.placeholder-panel` 使用 `22px 22px` 网格。
- `.viewfinder span` 尺寸 `38px × 38px`，边框色 `oklch(68% 0.07 31 / 0.46)`。
- 普通 hover 动效使用 `160ms-180ms ease`。
- 搜索框装饰动效使用 `220ms-260ms ease`。
- 视频文案显隐使用 `260ms-320ms ease`。
- 项目存在 `@media (prefers-reduced-motion: reduce)`，新增动画必须遵守减少动态设置。
