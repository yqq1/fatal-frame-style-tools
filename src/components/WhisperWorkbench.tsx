import gsap from 'gsap';
import {
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Download,
  FileAudio,
  FileText,
  FolderInput,
  Loader2,
  Music2,
  Play,
  Square,
  TerminalSquare,
  Upload,
  XCircle,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { musicTracks } from '../data/music';

type WhisperLanguage = 'auto' | 'Japanese' | 'Chinese' | 'English';
type WhisperModel = 'tiny' | 'base' | 'small' | 'medium' | 'large';
type WhisperDevice = 'cuda' | 'cpu';
type WhisperFormat = 'srt' | 'vtt' | 'txt';
type SourceMode = 'upload' | 'path';

type WhisperOutput = {
  name: string;
  size: number;
  downloadUrl: string;
};

type WhisperJob = {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  message: string;
  command: string;
  outputDir: string;
  outputFormat: WhisperFormat;
  canImport: boolean;
  outputs: WhisperOutput[];
  logs: string[];
};

const languageOptions: Array<{ value: WhisperLanguage; label: string }> = [
  { value: 'auto', label: '自动识别' },
  { value: 'Japanese', label: '日语' },
  { value: 'Chinese', label: '中文' },
  { value: 'English', label: '英语' },
];

const modelOptions: WhisperModel[] = ['tiny', 'base', 'small', 'medium', 'large'];
const modelSelectOptions = modelOptions.map((value) => ({ value, label: value }));
const deviceOptions: Array<{ value: WhisperDevice; label: string }> = [
  { value: 'cuda', label: 'GPU (CUDA)' },
  { value: 'cpu', label: 'CPU' },
];
const formatOptions: WhisperFormat[] = ['srt', 'vtt', 'txt'];
const formatSelectOptions = formatOptions.map((value) => ({ value, label: value }));
const defaultWhisperExecutable = 'C:\\Users\\ADMIN\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\whisper.exe';
const defaultModelDir = 'D:\\ce_study\\WhisperModels';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function quoteCommandPart(value: string) {
  if (!/[\s"'&|<>]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function buildWhisperCommand({
  executable,
  input,
  language,
  model,
  device,
  modelDir,
  outputDir,
  outputFormat,
}: {
  executable: string;
  input: string;
  language: WhisperLanguage;
  model: WhisperModel;
  device: WhisperDevice;
  modelDir: string;
  outputDir: string;
  outputFormat: WhisperFormat;
}) {
  const parts = [
    executable.trim() || 'whisper',
    input || '<audio-file>',
    '--model',
    model,
    '--model_dir',
    modelDir || defaultModelDir,
    '--device',
    device,
    '--output_format',
    outputFormat,
    '--output_dir',
    outputDir || 'data/whisper-outputs',
  ];

  if (language !== 'auto') {
    parts.push('--language', language);
  }

  return parts.map(quoteCommandPart).join(' ');
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function WhisperSelect<T extends string>({
  disabled = false,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  value: T;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !isOpen || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        menu,
        { y: -6, autoAlpha: 0, scale: 0.98 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.18, ease: 'power2.out', overwrite: 'auto' },
      );
      gsap.fromTo(
        menu.querySelectorAll('.whisper-select-option'),
        { y: 5, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.16, ease: 'power2.out', stagger: 0.03, overwrite: 'auto' },
      );
    }, menu);

    return () => context.revert();
  }, [isOpen]);

  return (
    <span
      className={`whisper-select ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        className="whisper-select-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${label}：${selectedOption?.label ?? ''}`}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{selectedOption?.label ?? value}</span>
        <ChevronDown className="whisper-select-chevron" size={14} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="whisper-select-menu" ref={menuRef} role="menu" aria-label={label}>
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                className={`whisper-select-option ${isSelected ? 'selected' : ''}`}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </span>
  );
}

function WhisperWorkbench({ prefillInputPath }: { prefillInputPath?: string }) {
  const [sourceMode, setSourceMode] = useState<SourceMode>('path');
  const [inputPath, setInputPath] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<WhisperLanguage>('auto');
  const [model, setModel] = useState<WhisperModel>('small');
  const [device, setDevice] = useState<WhisperDevice>('cuda');
  const [modelDir, setModelDir] = useState(defaultModelDir);
  const [outputFormat, setOutputFormat] = useState<WhisperFormat>('srt');
  const [outputDir, setOutputDir] = useState('data/whisper-outputs');
  const [executable, setExecutable] = useState(defaultWhisperExecutable);
  const [generateLyrics, setGenerateLyrics] = useState(true);
  const [targetTrackId, setTargetTrackId] = useState(musicTracks[0]?.id || '');
  const [job, setJob] = useState<WhisperJob | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  const commandInput = sourceMode === 'path' ? inputPath : audioFile ? audioFile.name : '<browser-selected-audio>';
  const canImportLyrics = generateLyrics && outputFormat !== 'txt';
  const commandPreview = useMemo(
    () =>
      buildWhisperCommand({
        executable,
        input: commandInput,
        language,
        model,
        device,
        modelDir,
        outputDir,
        outputFormat,
      }),
    [commandInput, device, executable, language, model, modelDir, outputDir, outputFormat],
  );
  const trackOptions = useMemo(
    () => musicTracks.map((track) => ({ value: track.id, label: `${track.title} - ${track.artist}` })),
    [],
  );

  useEffect(() => {
    if (!prefillInputPath) {
      return;
    }

    setSourceMode('path');
    setInputPath(prefillInputPath);
    setAudioFile(null);
    setMessage('已从 Demucs 带入 vocals 路径，可直接运行 Whisper。');
  }, [prefillInputPath]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll('[data-whisper-motion]'),
        { y: 14, autoAlpha: 0, scale: 0.99 },
        {
          y: 0,
          autoAlpha: 1,
          scale: 1,
          duration: 0.42,
          ease: 'power3.out',
          stagger: 0.055,
          clearProps: 'transform,visibility',
        },
      );
    }, root);

    return () => context.revert();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !job || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll('.whisper-result-card'),
        { y: 12, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.28, ease: 'power2.out', stagger: 0.04, clearProps: 'transform,visibility' },
      );
    }, root);

    return () => context.revert();
  }, [job?.status, job?.outputs.length]);

  useEffect(() => {
    if (!job || job.status !== 'running') {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/whisper/jobs/${job.id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || '无法读取 Whisper 任务状态');
        }

        setJob(data.job);
      } catch (error) {
        setJob((current) =>
          current
            ? {
                ...current,
                status: 'failed',
                message: error instanceof Error ? error.message : '无法读取 Whisper 任务状态',
              }
            : current,
        );
      }
    }, 1300);

    return () => window.clearInterval(timer);
  }, [job]);

  useEffect(() => {
    if (outputFormat === 'txt' && generateLyrics) {
      setGenerateLyrics(false);
    }
  }, [generateLyrics, outputFormat]);

  async function copyCommand() {
    await navigator.clipboard.writeText(commandPreview);
    setMessage('命令已复制。');
  }

  async function runWhisper() {
    setMessage('');
    setIsSubmitting(true);
    setJob(null);

    try {
      let response: Response;

      if (sourceMode === 'upload') {
        if (!audioFile) {
          throw new Error('请选择音频文件。');
        }

        const query = new URLSearchParams({
          sourceMode,
          filename: audioFile.name,
          language,
          model,
          device,
          modelDir,
          outputFormat,
          outputDir,
          executable,
        });
        response = await fetch(`/api/whisper/jobs?${query.toString()}`, {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream' },
          body: audioFile,
        });
      } else {
        if (!inputPath.trim()) {
          throw new Error('请填写本地音频路径。');
        }

        response = await fetch('/api/whisper/jobs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sourceMode,
            inputPath,
            language,
            model,
            device,
            modelDir,
            outputFormat,
            outputDir,
            executable,
          }),
        });
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Whisper 任务创建失败。');
      }

      setJob(data.job);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Whisper 任务创建失败。');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function stopWhisper() {
    if (!job || job.status !== 'running') {
      return;
    }

    setIsStopping(true);
    setMessage('');

    try {
      const response = await fetch(`/api/whisper/jobs/${job.id}/stop`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '停止 Whisper 任务失败。');
      }

      setJob(data.job);
      setMessage('已停止转写。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '停止 Whisper 任务失败。');
    } finally {
      setIsStopping(false);
    }
  }

  async function importLyrics(fileName: string) {
    if (!job || !targetTrackId) {
      return;
    }

    setIsImporting(true);
    setMessage('');

    try {
      const response = await fetch(`/api/whisper/jobs/${job.id}/import-lyrics`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trackId: targetTrackId, fileName }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '歌词导入失败。');
      }

      setMessage(`已导入 ${data.count} 行歌词。切到音乐页或刷新音乐页即可读取字幕。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '歌词导入失败。');
    } finally {
      setIsImporting(false);
    }
  }

  const statusIcon =
    job?.status === 'completed' ? (
      <CheckCircle2 size={18} aria-hidden="true" />
    ) : job?.status === 'running' ? (
      <Loader2 size={18} aria-hidden="true" />
    ) : (
      <XCircle size={18} aria-hidden="true" />
    );

  return (
    <section className="workbench whisper-workbench" ref={rootRef} aria-label="Whisper 转写工作区">
      <div className="viewfinder">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="butterfly whisper-butterfly" aria-hidden="true">
        <span />
        <span />
      </div>

      <div className="workbench-head" data-whisper-motion>
        <span className="workbench-icon">
          <FileAudio size={30} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">local whisper runner</p>
          <h2>Whisper 转写</h2>
        </div>
      </div>
      <p className="workbench-text" data-whisper-motion>
        选择音频或填写本地路径，生成命令并在本机运行 Whisper。结果保存在项目输出目录，可下载或导入音乐播放器歌词。
      </p>

      <div className="whisper-grid" data-whisper-motion>
        <div className="whisper-panel whisper-source-panel">
          <div className="whisper-panel-head">
            <FolderInput size={18} aria-hidden="true" />
            <strong>音频来源</strong>
          </div>
          <div className="whisper-source-layout">
            <div className="whisper-choice-row">
              <button className={sourceMode === 'path' ? 'active' : ''} type="button" onClick={() => setSourceMode('path')}>
                本地路径
              </button>
              <button className={sourceMode === 'upload' ? 'active' : ''} type="button" onClick={() => setSourceMode('upload')}>
                选择文件
              </button>
            </div>

            <div className="whisper-source-main">
              {sourceMode === 'path' ? (
                <label className="whisper-field">
                  <span>音频路径</span>
                  <input value={inputPath} onChange={(event) => setInputPath(event.target.value)} placeholder="D:\music\track.mp3" />
                </label>
              ) : (
                <label className="whisper-file-field">
                  <Upload size={18} aria-hidden="true" />
                  <span>{audioFile ? audioFile.name : '选择音频文件'}</span>
                  <input
                    accept="audio/*,.m4a,.flac,.wav,.mp3,.ogg"
                    type="file"
                    onChange={(event) => setAudioFile(event.target.files?.[0] || null)}
                  />
                </label>
              )}
              <p className="whisper-hint">
                {sourceMode === 'upload' ? '浏览器不会暴露原始路径，执行时会先上传到项目临时目录。' : '路径会交给本机 Node 服务执行，请使用当前机器可访问的路径。'}
              </p>
            </div>
          </div>
        </div>

        <div className="whisper-panel whisper-config-panel">
          <div className="whisper-panel-head">
            <TerminalSquare size={18} aria-hidden="true" />
            <strong>参数配置</strong>
          </div>
          <div className="whisper-config-grid">
            <label className="whisper-field">
              <span>语言</span>
              <WhisperSelect label="语言" options={languageOptions} value={language} onChange={setLanguage} />
            </label>
            <label className="whisper-field">
              <span>模型</span>
              <WhisperSelect label="模型" options={modelSelectOptions} value={model} onChange={setModel} />
            </label>
            <label className="whisper-field">
              <span>输出格式</span>
              <WhisperSelect label="输出格式" options={formatSelectOptions} value={outputFormat} onChange={setOutputFormat} />
            </label>
            <label className="whisper-field">
              <span>计算设备</span>
              <WhisperSelect label="计算设备" options={deviceOptions} value={device} onChange={setDevice} />
            </label>
          </div>
          <div className="whisper-path-grid">
            <label className="whisper-field">
              <span>Whisper 命令</span>
              <input value={executable} onChange={(event) => setExecutable(event.target.value)} placeholder="whisper" />
            </label>
            <label className="whisper-field whisper-model-dir-field">
              <span>模型目录</span>
              <input value={modelDir} onChange={(event) => setModelDir(event.target.value)} placeholder={defaultModelDir} />
            </label>
            <label className="whisper-field">
              <span>输出目录</span>
              <input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} placeholder="data/whisper-outputs" />
            </label>
          </div>
        </div>
      </div>

      <div className="whisper-command-card" data-whisper-motion>
        <div className="whisper-panel-head">
          <FileText size={18} aria-hidden="true" />
          <strong>实时命令</strong>
        </div>
        <code>{commandPreview}</code>
        <div className="whisper-actions">
          <button type="button" onClick={copyCommand}>
            <Clipboard size={16} aria-hidden="true" />
            复制命令
          </button>
          <button className="primary-action" disabled={isSubmitting || job?.status === 'running'} type="button" onClick={runWhisper}>
            {isSubmitting || job?.status === 'running' ? <Loader2 size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
            开始转写
          </button>
          {job?.status === 'running' ? (
            <button className="stop-action" disabled={isStopping} type="button" onClick={stopWhisper}>
              {isStopping ? <Loader2 size={16} aria-hidden="true" /> : <Square size={15} aria-hidden="true" />}
              停止转写
            </button>
          ) : null}
        </div>
      </div>

      <div className="whisper-import-strip" data-whisper-motion>
        <label className="whisper-toggle">
          <input
            checked={generateLyrics}
            disabled={outputFormat === 'txt'}
            type="checkbox"
            onChange={(event) => setGenerateLyrics(event.target.checked)}
          />
          <span>生成歌词数据</span>
        </label>
        <label className="whisper-field whisper-track-select">
          <span>导入到播放器</span>
          <WhisperSelect
            disabled={!canImportLyrics}
            label="导入到播放器"
            options={trackOptions}
            value={targetTrackId}
            onChange={setTargetTrackId}
          />
        </label>
        {outputFormat === 'txt' ? <span className="whisper-muted">txt 没有时间轴，不能导入歌词。</span> : null}
      </div>

      {job ? (
        <div className={`whisper-job whisper-job-${job.status}`} data-whisper-motion>
          <div className="whisper-job-status">
            {statusIcon}
            <strong>{job.message}</strong>
            <span>{job.status === 'running' ? '运行中' : job.status === 'completed' ? '已完成' : job.status === 'stopped' ? '已停止' : '失败'}</span>
          </div>

          {job.outputs.length ? (
            <div className="whisper-results">
              {job.outputs.map((output) => (
                <div className="whisper-result-card" key={output.name}>
                  <div>
                    <strong>{output.name}</strong>
                    <span>{formatBytes(output.size)}</span>
                  </div>
                  <a href={output.downloadUrl} download>
                    <Download size={16} aria-hidden="true" />
                    下载
                  </a>
                  {canImportLyrics && job.canImport ? (
                    <button disabled={isImporting} type="button" onClick={() => importLyrics(output.name)}>
                      <Music2 size={16} aria-hidden="true" />
                      导入
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {job.logs.length ? (
            <pre className="whisper-log">{job.logs.join('\n')}</pre>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="whisper-message">{message}</p> : null}
    </section>
  );
}

export default WhisperWorkbench;
