import {
  Captions,
  ChevronDown,
  ListMusic,
  Music,
  Pause,
  Play,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import gsap from 'gsap';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import type { PlaybackMode } from '../context/MusicPlayerContext';
import { useLyricPictureInPictureControls } from '../context/LyricPictureInPictureContext';
import type { MusicLyricLine, MusicTrack } from '../data/music';
import useLyricDragScroll from '../hooks/useLyricDragScroll';
import useMusicMotion from '../hooks/useMusicMotion';
import useRuntimeMusicLyrics from '../hooks/useRuntimeMusicLyrics';
import { getActiveLyricIndex } from '../lib/musicLyricSync';

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMaxScrollTop(element: HTMLElement) {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function getTrackDuration(track: MusicTrack, duration: number) {
  return duration > 0 ? formatTime(duration) : track.duration;
}

type MusicViewProps = {
  variant?: 'desktop' | 'mobile';
};

const playbackModeLabels: Record<PlaybackMode, string> = {
  sequence: '顺序播放',
  'repeat-one': '单曲循环',
  shuffle: '随机播放',
};

type PanelDragSample = {
  time: number;
  y: number;
};

type PanelDragState = {
  moved: boolean;
  pointerId: number;
  samples: PanelDragSample[];
  startScrollTop: number;
  startY: number;
  started: boolean;
};

function usePanelDragScroll() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<PanelDragState | null>(null);
  const scrollTweenRef = useRef<gsap.core.Tween | null>(null);
  const suppressClickRef = useRef(false);
  const originalUserSelectRef = useRef('');
  const [isDragging, setIsDragging] = useState(false);

  const killScrollTween = useCallback(() => {
    scrollTweenRef.current?.kill();
    scrollTweenRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      killScrollTween();
      document.body.style.userSelect = originalUserSelectRef.current;
    };
  }, [killScrollTween]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) {
        return;
      }

      const container = scrollRef.current;
      if (!container) {
        return;
      }

      killScrollTween();
      dragStateRef.current = {
        moved: false,
        pointerId: event.pointerId,
        samples: [{ time: performance.now(), y: event.clientY }],
        startScrollTop: container.scrollTop,
        startY: event.clientY,
        started: false,
      };
    },
    [killScrollTween],
  );

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const container = scrollRef.current;
    const dragState = dragStateRef.current;
    if (!container || !dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = event.clientY - dragState.startY;
    if (!dragState.started && Math.abs(deltaY) <= 6) {
      return;
    }

    if (!dragState.started) {
      dragState.started = true;
      container.setPointerCapture(event.pointerId);
      originalUserSelectRef.current = document.body.style.userSelect;
      document.body.style.userSelect = 'none';
      setIsDragging(true);
    }

    event.preventDefault();

    const maxScrollTop = getMaxScrollTop(container);
    let nextScrollTop = dragState.startScrollTop - deltaY;
    let overscrollY = 0;

    if (nextScrollTop < 0) {
      overscrollY = -nextScrollTop * 0.14;
      nextScrollTop *= 0.3;
    } else if (nextScrollTop > maxScrollTop) {
      overscrollY = -(nextScrollTop - maxScrollTop) * 0.14;
      nextScrollTop = maxScrollTop + (nextScrollTop - maxScrollTop) * 0.3;
    }

    container.scrollTop = clamp(nextScrollTop, 0, maxScrollTop);
    gsap.set(container, { y: overscrollY });

    if (Math.abs(deltaY) > 4) {
      dragState.moved = true;
    }

    dragState.samples.push({ time: performance.now(), y: event.clientY });
    dragState.samples = dragState.samples.slice(-6);
  }, []);

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = scrollRef.current;
      const dragState = dragStateRef.current;
      if (!container || !dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      if (!dragState.started) {
        dragStateRef.current = null;
        return;
      }

      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }

      document.body.style.userSelect = originalUserSelectRef.current;
      setIsDragging(false);
      dragStateRef.current = null;

      if (dragState.moved) {
        event.preventDefault();
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 180);
      }

      const samples = dragState.samples;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const elapsed = last && first ? Math.max(1, last.time - first.time) : 1;
      const velocity = last && first ? (last.y - first.y) / elapsed : 0;
      const maxScrollTop = getMaxScrollTop(container);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      killScrollTween();

      if (reducedMotion || Math.abs(velocity) < 0.08) {
        gsap.to(container, { y: 0, duration: reducedMotion ? 0 : 0.2, ease: 'power2.out', overwrite: 'auto' });
        return;
      }

      scrollTweenRef.current = gsap.to(container, {
        scrollTop: clamp(container.scrollTop - velocity * 420, 0, maxScrollTop),
        y: 0,
        duration: 0.5,
        ease: 'power3.out',
        overwrite: 'auto',
        onComplete: () => {
          scrollTweenRef.current = null;
        },
      });
    },
    [killScrollTween],
  );

  return {
    isDragging,
    scrollRef,
    scrollHandlers: {
      onPointerCancel: finishDrag,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishDrag,
    },
    shouldSuppressClick: () => suppressClickRef.current,
  };
}

function MusicView({ variant = 'desktop' }: MusicViewProps) {
  const { selectedTrack, tracks } = useMusicPlayer();

  if (tracks.length === 0 || !selectedTrack) {
    return (
      <section className="music-empty" aria-label="音乐播放器">
        <Music size={34} aria-hidden="true" />
        <h2>暂无音乐</h2>
        <p>将音频文件放到 public/musics，并在 src/data/music.ts 中添加曲目。</p>
      </section>
    );
  }

  return <MusicPlayerShell variant={variant} />;
}

function MusicPlayerShell({ variant }: {
  variant: 'desktop' | 'mobile';
}) {
  const motionRootRef = useRef<HTMLDivElement | null>(null);
  const [lyricPulseKey, setLyricPulseKey] = useState(0);
  const runtimeLyrics = useRuntimeMusicLyrics();
  const lyricPip = useLyricPictureInPictureControls();
  const {
    canMove,
    currentTime,
    duration,
    hasError,
    isMuted,
    isPlaying,
    playbackMode,
    progress,
    seekTo,
    selectByDirection,
    selectedIndex,
    selectedTrack,
    selectTrack,
    setPlaybackMode,
    setPlayerVolume,
    toggleMute,
    togglePlay,
    tracks,
    volume,
    volumeProgress,
  } = useMusicPlayer();

  if (!selectedTrack) {
    return null;
  }

  const lyrics = runtimeLyrics[selectedTrack.id] ?? selectedTrack.lyrics ?? [];
  const activeLyricIndex = getActiveLyricIndex(lyrics, currentTime);
  const sourceHint = selectedTrack.src || '/musics';

  useMusicMotion(motionRootRef, {
    activeLyricIndex,
    isPlaying,
    lyricPulseKey,
    selectedTrackId: selectedTrack.id,
  });

  function seekToLyric(time: number) {
    seekTo(time);
    setLyricPulseKey((value) => value + 1);
  }

  return (
    <div className={`music-theater ${variant === 'mobile' ? 'mobile-music-theater' : ''}`} ref={motionRootRef}>
      <MusicPlaylist selectedTrack={selectedTrack} tracks={tracks} onSelect={selectTrack} />

      <section className="music-stage music-theater-panel" data-music-motion="panel" aria-label="音乐播放器">
        <div className={`music-instrument ${isPlaying ? 'playing' : 'paused'}`}>
          <MusicVisual isPlaying={isPlaying} />
          <div className="music-copy">
            <p className="eyebrow">lyric theater</p>
            <h2>{selectedTrack.title}</h2>
            <span>{selectedTrack.artist}</span>
            <em>
              {selectedIndex + 1} / {tracks.length} · {getTrackDuration(selectedTrack, duration)}
            </em>
          </div>

          {hasError ? (
            <div className="music-error" role="status">
              <strong>音乐文件未找到</strong>
              <span>请将文件放到 {sourceHint}，或修改 src/data/music.ts 中的 src。</span>
            </div>
          ) : null}

          <MusicControls
            canMove={canMove}
            currentTime={currentTime}
            duration={duration}
            isMuted={isMuted}
            isPlaying={isPlaying}
            playbackMode={playbackMode}
            progress={progress}
            trackDuration={getTrackDuration(selectedTrack, duration)}
            volume={volume}
            volumeProgress={volumeProgress}
            lyricPipControl={
              <button
                className={`music-control music-lyric-pip-control ${lyricPip.isOpen ? 'active' : ''} ${lyricPip.isAvailable ? '' : 'unavailable'}`}
                type="button"
                aria-label={lyricPip.isAvailable ? (lyricPip.isOpen ? '关闭字幕小窗' : '打开字幕小窗') : lyricPip.unavailableReason}
                aria-pressed={lyricPip.isOpen}
                disabled={!lyricPip.isAvailable}
                title={lyricPip.isAvailable ? undefined : lyricPip.unavailableReason}
                onClick={() => {
                  void lyricPip.toggle();
                }}
              >
                <Captions size={18} aria-hidden="true" />
                <span>字幕小窗</span>
              </button>
            }
            onMute={toggleMute}
            onPlaybackModeChange={setPlaybackMode}
            onPlayToggle={togglePlay}
            onSeek={seekTo}
            onSkipBack={() => selectByDirection(-1)}
            onSkipForward={() => selectByDirection(1)}
            onVolumeChange={setPlayerVolume}
          />
        </div>
      </section>

      <MusicLyrics activeIndex={activeLyricIndex} currentTime={currentTime} lyrics={lyrics} onSeek={seekToLyric} />
    </div>
  );
}

function MusicVisual({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className={`music-orbit ${isPlaying ? 'playing' : 'paused'}`} aria-hidden="true">
      <span className="music-orbit-line" />
      <span className="music-orbit-line" />
      <span className="music-orbit-line" />
      <span className="music-orbit-core">
        <Music size={38} aria-hidden="true" />
      </span>
      <span className="music-butterfly-mark" />
      <span className="music-wave-row">
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function PlaybackModeIcon({ mode, size = 18 }: { mode: PlaybackMode; size?: number }) {
  if (mode === 'repeat-one') {
    return <Repeat1 size={size} aria-hidden="true" />;
  }

  if (mode === 'shuffle') {
    return <Shuffle size={size} aria-hidden="true" />;
  }

  return <ListMusic size={size} aria-hidden="true" />;
}

function PlaybackModePicker({
  canShuffle,
  mode,
  onModeChange,
}: {
  canShuffle: boolean;
  mode: PlaybackMode;
  onModeChange: (mode: PlaybackMode) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const modes: PlaybackMode[] = ['sequence', 'repeat-one', 'shuffle'];

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !isOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        menu,
        { y: 8, scale: 0.96, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.2, ease: 'power3.out', overwrite: 'auto' },
      );
      gsap.fromTo(
        menu.querySelectorAll('.music-mode-option'),
        { y: 5, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.18, ease: 'power2.out', stagger: 0.035, overwrite: 'auto' },
      );
    }, menu);

    return () => context.revert();
  }, [isOpen]);

  return (
    <span
      className={`music-mode-picker ${isOpen ? 'open' : ''}`}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        className={`music-control music-mode-trigger ${mode !== 'sequence' ? 'active' : ''}`}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`播放模式：${playbackModeLabels[mode]}`}
        onClick={() => setIsOpen((value) => !value)}
      >
        <PlaybackModeIcon mode={mode} />
        <ChevronDown className="music-mode-chevron" size={12} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="music-mode-menu" ref={menuRef} role="menu" aria-label="选择播放模式">
          {modes.map((nextMode) => {
            const isDisabled = nextMode === 'shuffle' && !canShuffle;
            const isSelected = nextMode === mode;

            return (
              <button
                className={`music-mode-option ${isSelected ? 'selected' : ''}`}
                type="button"
                role="menuitemradio"
                aria-checked={isSelected}
                disabled={isDisabled}
                key={nextMode}
                onClick={() => {
                  if (isDisabled) {
                    return;
                  }

                  onModeChange(nextMode);
                  setIsOpen(false);
                }}
              >
                <PlaybackModeIcon mode={nextMode} size={16} />
                <span>{playbackModeLabels[nextMode]}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </span>
  );
}

function VolumePicker({
  isMuted,
  volume,
  volumeProgress,
  onMute,
  onVolumeChange,
}: {
  isMuted: boolean;
  volume: number;
  volumeProgress: number;
  onMute: () => void;
  onVolumeChange: (value: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLSpanElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const picker = pickerRef.current;
      if (!picker || !(event.target instanceof Node) || picker.contains(event.target)) {
        return;
      }

      setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover || !isOpen || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        popover,
        { y: 8, scale: 0.96, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.2, ease: 'power3.out', overwrite: 'auto' },
      );
    }, popover);

    return () => context.revert();
  }, [isOpen]);

  return (
    <span
      className={`music-volume-picker ${isOpen ? 'open' : ''}`}
      ref={pickerRef}
    >
      <button
        className={`music-control ${isMuted || isOpen ? 'active' : ''}`}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={isOpen ? (isMuted ? '恢复音量' : '静音') : '打开音量调节'}
        onClick={() => {
          if (isOpen) {
            onMute();
            return;
          }

          setIsOpen(true);
        }}
      >
        {isMuted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
      </button>
      {isOpen ? (
        <div className="music-volume-popover" ref={popoverRef} role="dialog" aria-label="音量调节">
          <span className="music-volume-shell" style={{ '--music-volume': `${volumeProgress}%` } as CSSProperties}>
            <input
              aria-label="音量"
              className="music-volume-range"
              max={1}
              min={0}
              step={0.01}
              type="range"
              value={isMuted ? 0 : volume}
              onChange={(event) => onVolumeChange(Number(event.target.value))}
            />
          </span>
        </div>
      ) : null}
    </span>
  );
}

function MusicControls({
  canMove,
  currentTime,
  duration,
  isMuted,
  isPlaying,
  playbackMode,
  progress,
  trackDuration,
  volume,
  volumeProgress,
  lyricPipControl,
  onMute,
  onPlaybackModeChange,
  onPlayToggle,
  onSeek,
  onSkipBack,
  onSkipForward,
  onVolumeChange,
}: {
  canMove: boolean;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  isPlaying: boolean;
  playbackMode: PlaybackMode;
  progress: number;
  trackDuration: string;
  volume: number;
  volumeProgress: number;
  lyricPipControl?: ReactNode;
  onMute: () => void;
  onPlaybackModeChange: (mode: PlaybackMode) => void;
  onPlayToggle: () => void;
  onSeek: (value: number) => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  onVolumeChange: (value: number) => void;
}) {
  return (
    <div className="music-controls">
      <div className="music-progress">
        <span>{formatTime(currentTime)}</span>
        <span className="music-progress-track" style={{ '--music-progress': `${progress}%` } as CSSProperties}>
          <input
            aria-label="播放进度"
            max={duration || 0}
            min={0}
            step={0.1}
            style={{ backgroundSize: `${progress}% 100%` }}
            type="range"
            value={currentTime}
            onChange={(event) => onSeek(Number(event.target.value))}
          />
          <span className="progress-butterfly" aria-hidden="true">
            <span className="progress-butterfly-image" />
          </span>
        </span>
        <span>{trackDuration}</span>
      </div>

      <div className="music-control-row">
        <button className="music-control" type="button" aria-label="上一首" disabled={!canMove} onClick={onSkipBack}>
          <SkipBack size={18} aria-hidden="true" />
        </button>
        <button className="music-control music-play-button" type="button" aria-label={isPlaying ? '暂停' : '播放'} onClick={onPlayToggle}>
          {isPlaying ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
        </button>
        <button className="music-control" type="button" aria-label="下一首" disabled={!canMove} onClick={onSkipForward}>
          <SkipForward size={18} aria-hidden="true" />
        </button>
        <PlaybackModePicker canShuffle={canMove} mode={playbackMode} onModeChange={onPlaybackModeChange} />
        {lyricPipControl}
        <VolumePicker
          isMuted={isMuted}
          volume={volume}
          volumeProgress={volumeProgress}
          onMute={onMute}
          onVolumeChange={onVolumeChange}
        />
      </div>
    </div>
  );
}

function MusicLyrics({
  activeIndex,
  currentTime,
  lyrics,
  onSeek,
}: {
  activeIndex: number;
  currentTime: number;
  lyrics: MusicLyricLine[];
  onSeek: (time: number) => void;
}) {
  const activeLineRef = useRef<HTMLButtonElement | null>(null);
  const lyricScrollRef = useRef<HTMLDivElement | null>(null);
  const {
    isAutoFollowPaused,
    isDragging,
    lyricDragHandlers,
    resumeAutoFollow,
    shouldSuppressClick,
  } = useLyricDragScroll({
    activeIndex,
    activeLineRef,
    currentTime,
    scrollRef: lyricScrollRef,
  });

  return (
    <section
      className={`music-lyrics music-theater-panel ${isDragging ? 'dragging' : ''} ${isAutoFollowPaused ? 'manual' : ''}`}
      data-music-motion="panel"
      aria-label="同步字幕"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">synced lyrics</p>
          <h2>同步字幕</h2>
        </div>
        <span>{lyrics.length} 行</span>
      </div>

      {lyrics.length ? (
        <>
        <div className="music-lyric-scroll" ref={lyricScrollRef} {...lyricDragHandlers}>
          {lyrics.map((line, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                className={`music-lyric-line ${isActive ? 'active' : ''}`}
                key={`${line.time}-${index}`}
                ref={isActive ? activeLineRef : undefined}
                type="button"
                aria-current={isActive ? 'true' : undefined}
                onClick={() => {
                  if (shouldSuppressClick()) {
                    return;
                  }

                  onSeek(line.time);
                  resumeAutoFollow();
                }}
              >
                <span className="music-lyric-time">{formatTime(line.time)}</span>
                <span className="music-lyric-ja">{line.ja}</span>
                {line.zh ? <span className="music-lyric-zh">{line.zh}</span> : null}
              </button>
            );
          })}
        </div>
        {isAutoFollowPaused ? (
          <button className="music-follow-current" type="button" onClick={resumeAutoFollow}>
            定位当前
          </button>
        ) : null}
        </>
      ) : (
        <div className="music-lyrics-empty">
          <Music size={24} aria-hidden="true" />
          <strong>暂无同步字幕</strong>
          <span>在歌词数据里添加日语原文和中文翻译后，这里会随播放进度高亮。</span>
        </div>
      )}
    </section>
  );
}

function MusicPlaylist({
  selectedTrack,
  tracks,
  onSelect,
}: {
  selectedTrack: MusicTrack;
  tracks: MusicTrack[];
  onSelect: (id: string, autoplay?: boolean) => void;
}) {
  const { isDragging, scrollHandlers, scrollRef, shouldSuppressClick } = usePanelDragScroll();

  return (
    <aside className={`music-playlist music-theater-panel ${isDragging ? 'dragging' : ''}`} data-music-motion="panel" aria-label="音乐列表">
      <div className="section-heading">
        <div>
          <p className="eyebrow">prepared music</p>
          <h2>音乐列表</h2>
        </div>
        <span>{tracks.length} 项</span>
      </div>

      <div className="music-items" ref={scrollRef} {...scrollHandlers}>
        {tracks.map((track, index) => {
          const isSelected = track.id === selectedTrack.id;

          return (
            <button
              className={`music-item ${isSelected ? 'selected' : ''}`}
              data-motion="item"
              aria-current={isSelected ? 'true' : undefined}
              aria-pressed={isSelected}
              key={track.id}
              type="button"
              onClick={() => {
                if (shouldSuppressClick()) {
                  return;
                }

                onSelect(track.id);
              }}
            >
              <span className="music-item-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="music-item-copy">
                <strong>{track.title}</strong>
                <span className="music-item-meta">
                  <em>{track.artist}</em>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default MusicView;
