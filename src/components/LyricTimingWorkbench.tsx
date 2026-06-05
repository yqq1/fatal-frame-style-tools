import gsap from 'gsap';
import { ArrowDownUp, Clock3, FilePenLine, ListMusic, Pause, Play, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { musicTracks } from '../data/music';
import type { MusicLyricLine } from '../data/music';
import { cleanDraftLine, formatLyricTime, makeLyricKey, prefersReducedMotion, toDraftLines } from '../lib/lyricTiming';
import type { DraftLyricLine } from '../lib/lyricTiming';
import CrimsonSelect from './CrimsonSelect';
import LyricTimingRow from './LyricTimingRow';

type RuntimeLyricsResponse = {
  lyrics: Record<string, MusicLyricLine[]>;
};

export default function LyricTimingWorkbench() {
  const rootRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [lyricsMap, setLyricsMap] = useState<Record<string, MusicLyricLine[]>>({});
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [draftLines, setDraftLines] = useState<DraftLyricLine[]>([]);
  const [selectedLineKey, setSelectedLineKey] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [offset, setOffset] = useState('0');
  const [message, setMessage] = useState('正在读取生成字幕...');

  const generatedTracks = useMemo(
    () => musicTracks.filter((track) => (lyricsMap[track.id]?.length || 0) > 0),
    [lyricsMap],
  );
  const generatedTrackOptions = useMemo(
    () => generatedTracks.map((track) => ({ value: track.id, label: `${track.title} - ${track.artist}` })),
    [generatedTracks],
  );
  const selectedTrack = musicTracks.find((track) => track.id === selectedTrackId);
  const selectedLine = draftLines.find((line) => line.key === selectedLineKey);
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll('[data-lyric-motion]'),
        { y: 14, autoAlpha: 0, scale: 0.99 },
        { y: 0, autoAlpha: 1, scale: 1, duration: 0.42, ease: 'power3.out', stagger: 0.055, clearProps: 'transform,visibility' },
      );
    }, root);

    return () => context.revert();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !selectedLineKey || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      const row = root.querySelector(`[data-line-key="${selectedLineKey}"]`);
      if (row) {
        gsap.fromTo(row, { x: -4 }, { x: 0, duration: 0.24, ease: 'power2.out', clearProps: 'transform' });
      }
    }, root);

    return () => context.revert();
  }, [selectedLineKey]);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/music/generated-lyrics')
      .then((response) => {
        if (!response.ok) {
          throw new Error('无法读取生成字幕');
        }
        return response.json() as Promise<RuntimeLyricsResponse>;
      })
      .then((data) => {
        if (cancelled) {
          return;
        }

        const nextMap = data.lyrics || {};
        const firstTrack = musicTracks.find((track) => (nextMap[track.id]?.length || 0) > 0);
        setLyricsMap(nextMap);
        setSelectedTrackId(firstTrack?.id || '');
        setMessage(firstTrack ? '选择一行字幕后可写入当前时间。' : '还没有生成字幕，请先从 Whisper 转写导入。');
      })
      .catch((error) => {
        if (!cancelled) {
          setMessage(error.message || '无法读取生成字幕');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const lines = selectedTrackId ? lyricsMap[selectedTrackId] || [] : [];
    const nextDraft = toDraftLines(lines);
    setDraftLines(nextDraft);
    setSelectedLineKey(nextDraft[0]?.key || '');
    setIsDirty(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [lyricsMap, selectedTrackId]);

  function requireDiscard() {
    return !isDirty || window.confirm('有未保存改动，确定放弃并切换歌曲？');
  }

  function selectTrack(trackId: string) {
    if (!requireDiscard()) {
      return;
    }

    setSelectedTrackId(trackId);
    setMessage('选择一行字幕后可写入当前时间。');
  }

  function patchLine(key: string, patch: Partial<MusicLyricLine>) {
    setDraftLines((lines) => lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    setIsDirty(true);
  }

  function seekTo(time: number) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.currentTime = Math.max(0, time);
    setCurrentTime(audio.currentTime);
  }

  function writeCurrentTime() {
    if (!selectedLineKey) {
      return;
    }

    patchLine(selectedLineKey, { time: Math.round(currentTime * 1000) / 1000 });
  }

  function nudgeSelected(delta: number) {
    if (!selectedLine) {
      return;
    }

    patchLine(selectedLine.key, { time: Math.max(0, Math.round((selectedLine.time + delta) * 1000) / 1000) });
  }

  function addLine() {
    const line = {
      key: makeLyricKey(),
      time: Math.round(currentTime * 1000) / 1000,
      ja: '',
      zh: '',
    };
    setDraftLines((lines) => [...lines, line]);
    setSelectedLineKey(line.key);
    setIsDirty(true);
  }

  function deleteSelected() {
    if (!selectedLineKey) {
      return;
    }

    setDraftLines((lines) => {
      const next = lines.filter((line) => line.key !== selectedLineKey);
      setSelectedLineKey(next[0]?.key || '');
      return next;
    });
    setIsDirty(true);
  }

  function sortLines() {
    setDraftLines((lines) => [...lines].sort((a, b) => a.time - b.time));
    setIsDirty(true);
  }

  function applyOffset() {
    const delta = Number(offset);
    if (!Number.isFinite(delta)) {
      setMessage('整体偏移必须是数字秒数。');
      return;
    }

    setDraftLines((lines) => lines.map((line) => ({ ...line, time: Math.max(0, Math.round((line.time + delta) * 1000) / 1000) })));
    setIsDirty(true);
    setMessage(`已应用整体偏移 ${delta}s，保存后写入文件。`);
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
      return;
    }

    audio.pause();
    setIsPlaying(false);
  }

  async function saveLyrics() {
    if (!selectedTrackId) {
      return;
    }

    const lyrics = draftLines.map(cleanDraftLine).filter((line) => line.ja.trim() || line.zh?.trim());
    setIsSaving(true);
    setMessage('正在保存校正...');

    try {
      const response = await fetch(`/api/music/generated-lyrics/${encodeURIComponent(selectedTrackId)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lyrics }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '保存失败');
      }

      setLyricsMap((map) => ({ ...map, [selectedTrackId]: data.lyrics || lyrics }));
      setMessage(`已保存 ${data.count ?? lyrics.length} 行；刷新或重新进入音乐页即可读取。`);
      setIsDirty(false);

      if (!prefersReducedMotion() && rootRef.current) {
        gsap.fromTo('.lyric-timing-save', { scale: 0.98 }, { scale: 1, duration: 0.24, ease: 'back.out(2)', clearProps: 'transform' });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="workbench lyric-timing-workbench" aria-label="歌词校时工作区" ref={rootRef}>
      <div className="viewfinder">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="butterfly lyric-timing-butterfly" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="workbench-head" data-lyric-motion>
        <span className="workbench-icon">
          <Clock3 size={30} aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">generated lyrics editor</p>
          <h2>歌词校时</h2>
        </div>
      </div>
      <p className="workbench-text" data-lyric-motion>
        编辑 `generatedMusicLyrics.ts` 中已导入的字幕时间点和双语文本。草稿只在点击保存后写回文件。
      </p>

      {generatedTracks.length === 0 ? (
        <div className="lyric-timing-empty" data-lyric-motion>
          <ListMusic size={28} aria-hidden="true" />
          <strong>暂无生成字幕</strong>
          <span>先使用 Whisper 转写并导入到音乐 track，再回到这里校正时间。</span>
        </div>
      ) : (
        <div className="lyric-timing-grid">
          <section className="lyric-timing-panel lyric-timing-player" data-lyric-motion>
            <div className="lyric-timing-panel-head">
              <FilePenLine size={18} aria-hidden="true" />
              <strong>音频与操作</strong>
              <span className={isDirty ? 'unsaved' : ''}>{isDirty ? '未保存' : '已同步'}</span>
            </div>

            <label className="whisper-field">
              <span>生成字幕歌曲</span>
              <CrimsonSelect compact label="生成字幕歌曲" options={generatedTrackOptions} value={selectedTrackId} onChange={selectTrack} />
            </label>

            {selectedTrack ? (
              <>
                <audio
                  ref={audioRef}
                  preload="metadata"
                  src={selectedTrack.src}
                  onEnded={() => setIsPlaying(false)}
                  onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
                  onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                />
                <div className="lyric-timing-now">
                  <strong>{formatLyricTime(currentTime)}</strong>
                  <span>/ {formatLyricTime(duration)}</span>
                </div>
                <span className="lyric-timing-progress-track" style={{ '--lyric-progress': `${progress}%` } as CSSProperties}>
                  <input
                    aria-label="音频进度"
                    className="lyric-timing-range"
                    max={duration || 0}
                    min={0}
                    step={0.01}
                    type="range"
                    value={currentTime}
                    onChange={(event) => seekTo(Number(event.target.value))}
                  />
                  <span className="progress-butterfly" aria-hidden="true">
                    <span className="progress-butterfly-image" />
                  </span>
                </span>
                <div className="lyric-timing-actions">
                  <button type="button" className="primary-action" onClick={togglePlay}>
                    {isPlaying ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                    {isPlaying ? '暂停' : '播放'}
                  </button>
                  <button type="button" onClick={writeCurrentTime} disabled={!selectedLineKey}>
                    写入当前时间
                  </button>
                </div>
              </>
            ) : null}

            <div className="lyric-timing-nudges">
              {[-0.5, -0.1, 0.1, 0.5].map((delta) => (
                <button key={delta} type="button" onClick={() => nudgeSelected(delta)} disabled={!selectedLineKey}>
                  {delta > 0 ? '+' : ''}
                  {delta}s
                </button>
              ))}
            </div>

            <div className="lyric-timing-offset">
              <label className="whisper-field">
                <span>整体偏移秒数</span>
                <input value={offset} onChange={(event) => setOffset(event.target.value)} inputMode="decimal" />
              </label>
              <button type="button" onClick={applyOffset}>
                应用偏移
              </button>
            </div>

            <div className="lyric-timing-actions">
              <button type="button" onClick={addLine}>
                <Plus size={16} aria-hidden="true" />
                新增行
              </button>
              <button type="button" onClick={deleteSelected} disabled={!selectedLineKey}>
                <Trash2 size={16} aria-hidden="true" />
                删除行
              </button>
              <button type="button" onClick={sortLines}>
                <ArrowDownUp size={16} aria-hidden="true" />
                按时间排序
              </button>
            </div>

            <button className="lyric-timing-save primary-action" type="button" onClick={saveLyrics} disabled={isSaving || !selectedTrackId}>
              <Save size={16} aria-hidden="true" />
              {isSaving ? '保存中' : '保存校正'}
            </button>
            <p className="lyric-timing-message">{message}</p>
          </section>

          <section className="lyric-timing-panel lyric-timing-editor" data-lyric-motion>
            <div className="lyric-timing-panel-head">
              <ListMusic size={18} aria-hidden="true" />
              <strong>字幕行</strong>
              <span>{draftLines.length} 行</span>
            </div>
            <div className="lyric-timing-row-list">
              {draftLines.map((line, index) => (
                <LyricTimingRow
                  index={index}
                  isSelected={line.key === selectedLineKey}
                  key={line.key}
                  line={line}
                  onPatch={patchLine}
                  onSeek={seekTo}
                  onSelect={setSelectedLineKey}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
