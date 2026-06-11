import {
  Expand,
  Film,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  CSSProperties,
  FocusEvent,
  SyntheticEvent,
} from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { videos } from '../data/videos';
import type { VideoItem, VideoSource } from '../data/videos';
import useVideoRitualMotion from '../hooks/useVideoRitualMotion';

const videoPlayerStorageKey = 'fatal-frame.video-player.preferences';

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0:00';
  }

  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getVideoDurationLabel(video: VideoItem) {
  const duration = video.duration.trim();
  return duration && duration !== '00:00' ? duration : '';
}

function inferVideoType(src: string) {
  return src.toLocaleLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4';
}

function getVideoSources(video: VideoItem): VideoSource[] {
  if (video.sources?.length) {
    return video.sources;
  }

  return video.src ? [{ src: video.src, type: inferVideoType(video.src) }] : [];
}

function getSourceLabel(source: VideoSource, index: number) {
  return source.label ?? source.quality ?? (index === 0 ? '原始' : `线路 ${index + 1}`);
}

function getDefaultSourceIndex(video: VideoItem, sources: VideoSource[]) {
  if (!video.defaultQuality) {
    return 0;
  }

  const index = sources.findIndex((source) => source.quality === video.defaultQuality || source.label === video.defaultQuality);
  return index >= 0 ? index : 0;
}

function loadVideoPlayerPreferences() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(videoPlayerStorageKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as {
      isMuted?: boolean;
      volume?: number;
    };

    return {
      isMuted: Boolean(parsed.isMuted),
      volume: typeof parsed.volume === 'number' ? Math.min(Math.max(parsed.volume, 0), 1) : 0.82,
    };
  } catch {
    return null;
  }
}

function RitualMarks() {
  return (
    <span className="ritual-ring" aria-hidden="true">
      <i className="ritual-control-mark" />
      <i className="ritual-control-mark" />
      <i className="ritual-control-mark" />
      <i className="ritual-control-mark" />
    </span>
  );
}

function VideoThumbnail({ video, isSelected }: { video: VideoItem; isSelected: boolean }) {
  return (
    <span className="video-thumb">
      <img src={video.thumbnail} alt="" />
      {isSelected ? (
        <span className="playing-equalizer" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </span>
  );
}

type VideoViewProps = {
  variant?: 'desktop' | 'mobile';
};

function VideoView({ variant = 'desktop' }: VideoViewProps) {
  const [selectedId, setSelectedId] = useState(videos[0]?.id ?? '');
  const selectedVideo = useMemo(
    () => videos.find((video) => video.id === selectedId) ?? videos[0],
    [selectedId],
  );

  if (videos.length === 0 || !selectedVideo) {
    return (
      <section className="video-empty" aria-label="视频播放器">
        <Film size={34} aria-hidden="true" />
        <h2>暂无视频</h2>
        <p>将视频文件放到 public/videos，并在 src/data/videos.ts 中添加配置。</p>
      </section>
    );
  }

  return <VideoPlayer key={selectedVideo.id} selectedVideo={selectedVideo} variant={variant} onSelect={setSelectedId} />;
}

function VideoPlayer({
  selectedVideo,
  variant,
  onSelect,
}: {
  selectedVideo: VideoItem;
  variant: 'desktop' | 'mobile';
  onSelect: (id: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const motionRootRef = useRef<HTMLDivElement | null>(null);
  const pendingSourceSwitchRef = useRef<{ time: number; shouldPlay: boolean } | null>(null);
  const controlsHideTimerRef = useRef<number | null>(null);
  const storedPreferences = loadVideoPlayerPreferences();
  const [selectedSourceIndex, setSelectedSourceIndex] = useState(() => getDefaultSourceIndex(selectedVideo, getVideoSources(selectedVideo)));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(storedPreferences?.volume ?? 0.82);
  const [isMuted, setIsMuted] = useState(storedPreferences?.isMuted ?? false);
  const [hasError, setHasError] = useState(false);
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [isVolumePanelOpen, setIsVolumePanelOpen] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumeProgress = isMuted ? 0 : volume * 100;
  const videoSources = getVideoSources(selectedVideo);
  const safeSourceIndex = videoSources.length > 0 ? Math.min(selectedSourceIndex, videoSources.length - 1) : 0;
  const selectedSource = videoSources[safeSourceIndex];
  const selectedSourceLabel = selectedSource ? getSourceLabel(selectedSource, safeSourceIndex) : '';
  const selectedDurationLabel = getVideoDurationLabel(selectedVideo);
  const sourceHint = videoSources.map((source, index) => `${getSourceLabel(source, index)}: ${source.src}`).join(' 或 ');
  const shouldHideControls = isPlaying && !isControlsVisible && !isQualityMenuOpen && !isVolumePanelOpen && !hasError;

  useVideoRitualMotion(motionRootRef, [isPlaying, selectedVideo.id, isQualityMenuOpen, isVolumePanelOpen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        videoPlayerStorageKey,
        JSON.stringify({
          isMuted,
          volume,
        }),
      );
    } catch {
      return;
    }
  }, [isMuted, volume]);

  useEffect(() => {
    setSelectedSourceIndex(getDefaultSourceIndex(selectedVideo, getVideoSources(selectedVideo)));
    pendingSourceSwitchRef.current = null;
    clearControlsHideTimer();
    setIsControlsVisible(true);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setHasPlaybackStarted(false);
    setHasError(false);
    setIsQualityMenuOpen(false);
    setIsVolumePanelOpen(false);
  }, [selectedVideo.id]);

  useEffect(() => {
    if (!isPlaying || isQualityMenuOpen || isVolumePanelOpen || hasError) {
      clearControlsHideTimer();
      setIsControlsVisible(true);
      return;
    }

    revealControls();
    return clearControlsHideTimer;
  }, [isPlaying, isQualityMenuOpen, isVolumePanelOpen, hasError]);

  useEffect(() => {
    if (selectedSourceIndex >= videoSources.length && videoSources.length > 0) {
      setSelectedSourceIndex(0);
    }
  }, [selectedSourceIndex, videoSources.length]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !selectedSource?.src) {
      return;
    }

    video.load();
  }, [selectedSource?.src]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === frameRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();

    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, input, textarea, select, [role="menu"]')) {
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        void togglePlay();
      }

      if (event.key === 'ArrowLeft') {
        seekBy(-10);
      }

      if (event.key === 'ArrowRight') {
        seekBy(10);
      }

      if (event.key.toLocaleLowerCase() === 'm') {
        setIsMuted((value) => !value);
      }

      if (event.key.toLocaleLowerCase() === 'f') {
        void toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    if (!isQualityMenuOpen && !isVolumePanelOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsQualityMenuOpen(false);
        setIsVolumePanelOpen(false);
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const controls = controlsRef.current;
      if (controls && event.target instanceof Node && !controls.contains(event.target)) {
        setIsQualityMenuOpen(false);
        setIsVolumePanelOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isQualityMenuOpen, isVolumePanelOpen]);

  async function togglePlay() {
    const video = videoRef.current;
    if (!video || hasError) {
      return;
    }

    if (video.paused) {
      try {
        await video.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function getSeekDuration() {
    const video = videoRef.current;
    const mediaDuration = video && Number.isFinite(video.duration) ? video.duration : 0;
    const seekableDuration = video?.seekable.length ? video.seekable.end(video.seekable.length - 1) : 0;
    return duration || mediaDuration || seekableDuration || 0;
  }

  function seekTo(value: number) {
    const video = videoRef.current;
    const maxDuration = getSeekDuration();

    if (!video || !Number.isFinite(maxDuration) || maxDuration <= 0) {
      return;
    }

    const nextTime = Math.min(Math.max(value, 0), maxDuration);
    if (duration <= 0) {
      setDuration(maxDuration);
    }
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  function seekBy(offset: number) {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const nextTime = Math.min(Math.max(video.currentTime + offset, 0), video.duration || 0);
    seekTo(nextTime);
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    setDuration(video.duration || 0);

    const pendingSwitch = pendingSourceSwitchRef.current;
    if (!pendingSwitch) {
      return;
    }

    const nextTime = Math.min(pendingSwitch.time, video.duration || pendingSwitch.time);
    try {
      video.currentTime = nextTime;
      setCurrentTime(nextTime);
    } catch {
      setCurrentTime(0);
    }

    pendingSourceSwitchRef.current = null;
    if (pendingSwitch.shouldPlay) {
      void video.play().then(
        () => setIsPlaying(true),
        () => setIsPlaying(false),
      );
    }
  }

  function changeQuality(value: string) {
    const nextIndex = Number(value);
    if (!Number.isInteger(nextIndex) || nextIndex === safeSourceIndex) {
      return;
    }

    const video = videoRef.current;
    pendingSourceSwitchRef.current = {
      time: video?.currentTime ?? currentTime,
      shouldPlay: Boolean(video && !video.paused && !hasError),
    };
    setHasError(false);
    setSelectedSourceIndex(nextIndex);
  }

  function chooseQuality(index: number) {
    changeQuality(String(index));
    setIsQualityMenuOpen(false);
  }

  function toggleQualityMenu() {
    if (videoSources.length <= 1) {
      return;
    }

    setIsVolumePanelOpen(false);
    setIsQualityMenuOpen((value) => !value);
  }

  function handleQualityBlur(event: FocusEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
      setIsQualityMenuOpen(false);
    }
  }

  function handleVolumeButtonClick() {
    if (variant === 'mobile') {
      setIsQualityMenuOpen(false);
      setIsVolumePanelOpen((value) => !value);
      return;
    }

    setIsMuted((value) => !value);
  }

  function setPlayerVolume(value: number) {
    const nextVolume = Math.min(Math.max(value, 0), 1);
    setVolume(nextVolume);
    setIsMuted(nextVolume <= 0);
  }

  function clearControlsHideTimer() {
    if (controlsHideTimerRef.current !== null) {
      window.clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }

  function scheduleControlsHide() {
    clearControlsHideTimer();

    if (!isPlaying || isQualityMenuOpen || isVolumePanelOpen || hasError) {
      return;
    }

    controlsHideTimerRef.current = window.setTimeout(() => {
      if (controlsRef.current?.matches(':hover, :focus-within')) {
        scheduleControlsHide();
        return;
      }

      setIsControlsVisible(false);
    }, 1800);
  }

  function revealControls() {
    setIsControlsVisible(true);
    scheduleControlsHide();
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (frameRef.current?.requestFullscreen) {
        await frameRef.current.requestFullscreen();
      }
    } catch {
      setIsFullscreen(false);
    }
  }

  return (
    <div className="video-grid" ref={motionRootRef}>
      <section className="video-stage" aria-label="视频播放器">
        <div
          className={`video-frame ${isPlaying ? 'playing' : 'paused'} ${hasPlaybackStarted ? 'has-playback' : 'poster-preview'} ${shouldHideControls ? 'controls-hidden' : ''}`}
          ref={frameRef}
          onFocusCapture={revealControls}
          onPointerEnter={revealControls}
          onPointerMove={revealControls}
        >
          <video
            ref={videoRef}
            poster={selectedVideo.poster}
            preload="metadata"
            src={selectedSource?.src}
            onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => {
              setHasPlaybackStarted(true);
              setIsPlaying(true);
            }}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onError={() => {
              setHasError(true);
              setIsPlaying(false);
            }}
          />

          <div className="video-shade" />

          <div className="video-copy">
            {selectedDurationLabel ? <span>{selectedDurationLabel}</span> : null}
            <h2>{selectedVideo.title}</h2>
            <p>{selectedVideo.genre}</p>
            <em>{selectedVideo.description}</em>
          </div>

          {hasError ? (
            <div className="video-error" role="status">
              <strong>视频文件未找到</strong>
              <span>请将文件放到 {sourceHint || 'public/videos'}，或修改 src/data/videos.ts 中的 sources。</span>
            </div>
          ) : null}

          <div
            className="video-controls"
            ref={controlsRef}
            onFocus={revealControls}
            onPointerEnter={revealControls}
            onPointerLeave={scheduleControlsHide}
          >
            <div className="video-progress">
              <span>{formatTime(currentTime)}</span>
              <span className="video-progress-track" style={{ '--video-progress': `${progress}%` } as CSSProperties}>
                <input
                  aria-label="播放进度"
                  max={duration || 0}
                  min={0}
                  step={0.1}
                  type="range"
                  value={currentTime}
                  onChange={(event) => seekTo(Number(event.target.value))}
                />
                <span className="progress-butterfly" aria-hidden="true">
                  <span className="progress-butterfly-image" />
                </span>
              </span>
              <span>{formatTime(duration)}</span>
            </div>

            {variant === 'mobile' ? (
              <div
                className={`mobile-volume-panel ${isVolumePanelOpen ? 'open' : ''}`}
                role="group"
                aria-label="音量调节"
                aria-hidden={!isVolumePanelOpen}
              >
                <span>音量</span>
                <input
                  aria-label="音量"
                  className="mobile-volume-range"
                  disabled={!isVolumePanelOpen}
                  max={1}
                  min={0}
                  step={0.01}
                  style={{ backgroundSize: `${volumeProgress}% 100%` }}
                  type="range"
                  value={isMuted ? 0 : volume}
                  onChange={(event) => setPlayerVolume(Number(event.target.value))}
                />
                <strong>{Math.round(volumeProgress)}%</strong>
              </div>
            ) : null}

            <div className="video-control-row">
              <button className="ritual-control" data-control="seek-back" aria-label="后退 10 秒" onClick={() => seekBy(-10)}>
                <RitualMarks />
                <span className="control-symbol">
                  <SkipBack size={18} aria-hidden="true" />
                </span>
              </button>
              <button
                className="ritual-control play-button"
                data-control="play"
                aria-label={isPlaying ? '暂停' : '播放'}
                onClick={() => void togglePlay()}
              >
                <RitualMarks />
                <span className="control-symbol">
                  {isPlaying ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
                </span>
              </button>
              <button className="ritual-control" data-control="seek-forward" aria-label="前进 10 秒" onClick={() => seekBy(10)}>
                <RitualMarks />
                <span className="control-symbol">
                  <SkipForward size={18} aria-hidden="true" />
                </span>
              </button>
              <button className="ritual-control" data-control="restart" aria-label="重新开始" onClick={() => seekTo(0)}>
                <RitualMarks />
                <span className="control-symbol">
                  <RotateCcw size={18} aria-hidden="true" />
                </span>
              </button>
              <button
                className={`ritual-control volume-toggle ${isMuted ? 'muted' : ''}`}
                data-control="mute"
                aria-expanded={variant === 'mobile' ? isVolumePanelOpen : undefined}
                aria-label={variant === 'mobile' ? '音量调节' : isMuted ? '取消静音' : '静音'}
                onClick={handleVolumeButtonClick}
              >
                <RitualMarks />
                <span className="control-symbol">
                  {isMuted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
                </span>
              </button>
              <span className={`volume-shell ${isMuted ? 'muted' : ''}`} style={{ '--volume-progress': `${volumeProgress}%` } as CSSProperties}>
                <input
                  aria-label="音量"
                  className={`volume-range ${isMuted ? 'muted' : ''}`}
                  max={1}
                  min={0}
                  step={0.01}
                  type="range"
                  value={isMuted ? 0 : volume}
                  onChange={(event) => setPlayerVolume(Number(event.target.value))}
                />
                <span className="volume-amber" aria-hidden="true" />
              </span>
              {selectedSource ? (
                <span className="quality-cluster" onBlur={handleQualityBlur}>
                  <button
                    className={`quality-control ritual-control ${videoSources.length <= 1 ? 'locked' : ''}`}
                    data-control="quality"
                    type="button"
                    aria-disabled={videoSources.length <= 1}
                    aria-expanded={isQualityMenuOpen}
                    aria-haspopup="menu"
                    aria-label={`清晰度：${selectedSourceLabel}`}
                    title={`清晰度：${selectedSourceLabel}`}
                    onClick={toggleQualityMenu}
                  >
                    <RitualMarks />
                    <span className="quality-sheen" aria-hidden="true" />
                    <span className="quality-control-surface" aria-hidden="true">
                      <SlidersHorizontal size={14} aria-hidden="true" />
                      <span className="quality-current">{selectedSourceLabel}</span>
                    </span>
                  </button>
                  {isQualityMenuOpen ? (
                    <div className="quality-menu open" role="menu" aria-label="切换视频清晰度">
                      {videoSources.map((source, index) => {
                        const isSelectedSource = index === safeSourceIndex;

                        return (
                          <button
                            className={`quality-option ${isSelectedSource ? 'selected' : ''}`}
                            key={`${source.src}-${index}`}
                            role="menuitemradio"
                            type="button"
                            aria-checked={isSelectedSource}
                            onClick={() => chooseQuality(index)}
                          >
                            <span>{getSourceLabel(source, index)}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </span>
              ) : null}
              <button
                className="ritual-control"
                data-control="fullscreen"
                aria-label={isFullscreen ? '退出全屏' : '全屏'}
                aria-pressed={isFullscreen}
                onClick={() => void toggleFullscreen()}
              >
                <RitualMarks />
                <span className="control-symbol">
                  <Expand size={18} aria-hidden="true" />
                </span>
              </button>
            </div>
          </div>
        </div>
        {variant === 'mobile' ? (
          <div className="mobile-video-copy">
            {selectedDurationLabel ? <span>{selectedDurationLabel}</span> : null}
            <h2>{selectedVideo.title}</h2>
            <p>{selectedVideo.genre}</p>
            <em>{selectedVideo.description}</em>
          </div>
        ) : null}
      </section>

      <aside className="video-playlist" aria-label="视频列表">
        <div className="section-heading">
          <div>
            <p className="eyebrow">prepared videos</p>
            <h2>视频列表</h2>
          </div>
          <span>{videos.length} 项</span>
        </div>

        <div className="video-items">
          {videos.map((video) => {
            const isSelected = video.id === selectedVideo.id;
            const durationLabel = getVideoDurationLabel(video);

            return (
              <button
                className={`video-item ${isSelected ? 'selected' : ''}`}
                data-motion="item"
                aria-current={isSelected ? 'true' : undefined}
                aria-pressed={isSelected}
                key={video.id}
                onClick={() => onSelect(video.id)}
              >
                <span className="video-item-butterfly" aria-hidden="true" />
                <VideoThumbnail video={video} isSelected={isSelected} />
                <span className="video-item-copy">
                  <strong>{video.title}</strong>
                  {durationLabel ? <em>{durationLabel}</em> : null}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

export default VideoView;
