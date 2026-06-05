import gsap from 'gsap';
import { CheckCircle2, Clipboard, FileAudio, FolderInput, Loader2, Play, Square, TerminalSquare, Upload, XCircle } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import CrimsonSelect from './CrimsonSelect';
import DemucsResultCard from './DemucsResultCard';

type SourceMode = 'path' | 'upload';
type DemucsDevice = 'cuda' | 'cpu';

type DemucsOutput = {
  name: string;
  kind: 'vocals' | 'no_vocals';
  size: number;
  localPath: string;
  downloadUrl: string;
};

type DemucsJob = {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  message: string;
  command: string;
  outputDir: string;
  expectedOutputDir: string;
  vocalsPath: string;
  outputs: DemucsOutput[];
  logs: string[];
};

const defaultExecutable = 'C:\\Users\\ADMIN\\AppData\\Local\\Programs\\Python\\Python312\\Scripts\\demucs.exe';
const deviceOptions: Array<{ value: DemucsDevice; label: string }> = [
  { value: 'cuda', label: 'GPU (CUDA)' },
  { value: 'cpu', label: 'CPU' },
];

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function quoteCommandPart(value: string) {
  if (!/[\s"'&|<>]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '\\"')}"`;
}

function buildDemucsCommand({
  device,
  executable,
  input,
  outputDir,
}: {
  device: DemucsDevice;
  executable: string;
  input: string;
  outputDir: string;
}) {
  return [
    executable.trim() || defaultExecutable,
    '-d',
    device,
    '--two-stems',
    'vocals',
    '-o',
    outputDir || 'data/demucs-outputs',
    input || '<audio-file>',
  ]
    .map(quoteCommandPart)
    .join(' ');
}

export default function DemucsWorkbench({ onUseWhisperInput }: { onUseWhisperInput: (path: string) => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const [sourceMode, setSourceMode] = useState<SourceMode>('path');
  const [inputPath, setInputPath] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [executable, setExecutable] = useState(defaultExecutable);
  const [device, setDevice] = useState<DemucsDevice>('cuda');
  const [outputDir, setOutputDir] = useState('data/demucs-outputs');
  const [job, setJob] = useState<DemucsJob | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const commandInput = sourceMode === 'path' ? inputPath : audioFile ? audioFile.name : '<browser-selected-audio>';
  const commandPreview = useMemo(
    () => buildDemucsCommand({ device, executable, input: commandInput, outputDir }),
    [commandInput, device, executable, outputDir],
  );
  const vocalsOutput = job?.outputs.find((output) => output.kind === 'vocals' && output.name.toLocaleLowerCase().startsWith('vocals'));

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll('[data-demucs-motion]'),
        { y: 14, autoAlpha: 0, scale: 0.99 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.42, ease: 'power3.out', stagger: 0.055, clearProps: 'transform,visibility' },
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
        root.querySelectorAll('.demucs-result-card'),
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
        const response = await fetch(`/api/demucs/jobs/${job.id}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || '无法读取 Demucs 任务状态');
        }
        setJob(data.job);
      } catch (error) {
        setJob((current) =>
          current
            ? {
                ...current,
                status: 'failed',
                message: error instanceof Error ? error.message : '无法读取 Demucs 任务状态',
              }
            : current,
        );
      }
    }, 1300);

    return () => window.clearInterval(timer);
  }, [job]);

  async function copyCommand() {
    await navigator.clipboard.writeText(commandPreview);
    setMessage('命令已复制。');
  }

  async function copyVocalsPath() {
    const path = job?.vocalsPath || vocalsOutput?.localPath || '';
    if (!path) {
      return;
    }

    await navigator.clipboard.writeText(path);
    setMessage('vocals 路径已复制。');
  }

  async function runDemucs() {
    setIsSubmitting(true);
    setMessage('');

    try {
      const response =
        sourceMode === 'path'
          ? await fetch('/api/demucs/jobs', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ device, executable, inputPath, outputDir, sourceMode }),
            })
          : await uploadDemucsFile();
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '无法启动 Demucs');
      }
      setJob(data.job);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法启动 Demucs');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function uploadDemucsFile() {
    if (!audioFile) {
      throw new Error('请选择音频文件');
    }

    const params = new URLSearchParams({
      device,
      executable,
      filename: audioFile.name,
      outputDir,
      sourceMode,
    });
    return fetch(`/api/demucs/jobs?${params.toString()}`, {
      method: 'POST',
      body: audioFile,
    });
  }

  async function stopDemucs() {
    if (!job || job.status !== 'running') {
      return;
    }

    setIsStopping(true);
    try {
      const response = await fetch(`/api/demucs/jobs/${job.id}/stop`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '无法停止 Demucs');
      }
      setJob(data.job);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法停止 Demucs');
    } finally {
      setIsStopping(false);
    }
  }

  function useVocalsInWhisper() {
    const path = job?.vocalsPath || vocalsOutput?.localPath || '';
    if (!path) {
      return;
    }

    onUseWhisperInput(path);
  }

  const canRun = sourceMode === 'path' ? inputPath.trim().length > 0 : Boolean(audioFile);
  const statusIcon =
    job?.status === 'completed' ? (
      <CheckCircle2 size={18} aria-hidden="true" />
    ) : job?.status === 'failed' || job?.status === 'stopped' ? (
      <XCircle size={18} aria-hidden="true" />
    ) : (
      <Loader2 size={18} aria-hidden="true" />
    );

  return (
    <section className="workbench demucs-workbench" aria-label="Demucs 人声分离工作区" ref={rootRef}>
      <div className="viewfinder">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="butterfly demucs-butterfly" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="workbench-head" data-demucs-motion>
        <span className="workbench-icon">
          <FileAudio size={30} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">vocal isolation console</p>
          <h2>Demucs 人声分离</h2>
        </div>
      </div>
      <p className="workbench-text" data-demucs-motion>
        先用 Demucs 分离人声，再把 vocals.wav 带入 Whisper，可减少伴奏对字幕转写的干扰。
      </p>

      <div className="demucs-grid">
        <section className="demucs-panel" data-demucs-motion>
          <div className="demucs-panel-head">
            <FolderInput size={18} aria-hidden="true" />
            <strong>音频来源</strong>
          </div>
          <div className="demucs-choice-row">
            <button className={sourceMode === 'path' ? 'active' : ''} type="button" onClick={() => setSourceMode('path')}>
              本地路径
            </button>
            <button className={sourceMode === 'upload' ? 'active' : ''} type="button" onClick={() => setSourceMode('upload')}>
              选择文件
            </button>
          </div>
          {sourceMode === 'path' ? (
            <label className="whisper-field">
              <span>音频本地路径</span>
              <input value={inputPath} onChange={(event) => setInputPath(event.target.value)} placeholder="D:\\...\\NOISE - 天野月.mp3" />
            </label>
          ) : (
            <label className="demucs-file-field">
              <Upload size={18} aria-hidden="true" />
              <span>{audioFile ? audioFile.name : '选择音频文件，浏览器不会暴露原始路径'}</span>
              <input type="file" accept="audio/*" onChange={(event) => setAudioFile(event.target.files?.[0] ?? null)} />
            </label>
          )}
        </section>

        <section className="demucs-panel" data-demucs-motion>
          <div className="demucs-panel-head">
            <TerminalSquare size={18} aria-hidden="true" />
            <strong>Demucs 配置</strong>
          </div>
          <div className="demucs-config-grid">
            <label className="whisper-field">
              <span>Demucs 可执行命令</span>
              <input value={executable} onChange={(event) => setExecutable(event.target.value)} />
            </label>
            <label className="whisper-field">
              <span>设备</span>
              <CrimsonSelect label="设备" options={deviceOptions} value={device} onChange={setDevice} />
            </label>
            <label className="whisper-field">
              <span>输出目录</span>
              <input value={outputDir} onChange={(event) => setOutputDir(event.target.value)} />
            </label>
          </div>
        </section>
      </div>

      <section className="demucs-command-card" data-demucs-motion>
        <div className="demucs-panel-head">
          <TerminalSquare size={18} aria-hidden="true" />
          <strong>实时命令</strong>
        </div>
        <code>{commandPreview}</code>
        <div className="demucs-actions">
          <button type="button" onClick={copyCommand}>
            <Clipboard size={16} aria-hidden="true" />
            复制命令
          </button>
          {job?.status === 'running' ? (
            <button className="stop-action" type="button" disabled={isStopping} onClick={stopDemucs}>
              <Square size={16} aria-hidden="true" />
              停止
            </button>
          ) : (
            <button className="primary-action" type="button" disabled={!canRun || isSubmitting} onClick={runDemucs}>
              <Play size={16} aria-hidden="true" />
              {isSubmitting ? '启动中' : '开始分离'}
            </button>
          )}
        </div>
      </section>

      {job ? (
        <section className={`demucs-job demucs-job-${job.status}`} data-demucs-motion>
          <div className="demucs-job-status">
            {statusIcon}
            <strong>{job.message}</strong>
            <span>{job.expectedOutputDir}</span>
          </div>
          {job.outputs.length ? (
            <div className="demucs-results">
              {job.outputs.map((output) => (
                <DemucsResultCard downloadUrl={output.downloadUrl} key={output.name} name={output.name} size={output.size} />
              ))}
            </div>
          ) : null}
          {job.vocalsPath || vocalsOutput?.localPath ? (
            <div className="demucs-vocals-strip">
              <span>{job.vocalsPath || vocalsOutput?.localPath}</span>
              <button type="button" onClick={copyVocalsPath}>
                <Clipboard size={16} aria-hidden="true" />
                复制 vocals 路径
              </button>
              <button type="button" className="primary-action" onClick={useVocalsInWhisper}>
                带入 Whisper 转写
              </button>
            </div>
          ) : null}
          {job.logs.length ? <pre className="demucs-log">{job.logs.join('\n')}</pre> : null}
        </section>
      ) : null}

      {message ? <p className="demucs-message">{message}</p> : null}
    </section>
  );
}
