import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { musicTracks } from '../data/music';
import type { MusicTrack } from '../data/music';

export type PlaybackMode = 'sequence' | 'repeat-one' | 'shuffle';

type MusicPlayerContextValue = {
  canMove: boolean;
  currentTime: number;
  duration: number;
  hasError: boolean;
  isMuted: boolean;
  isPlaying: boolean;
  playbackMode: PlaybackMode;
  progress: number;
  selectedIndex: number;
  selectedTrack?: MusicTrack;
  tracks: MusicTrack[];
  volume: number;
  volumeProgress: number;
  pauseAudio: () => void;
  playAudio: () => Promise<void>;
  seekTo: (value: number) => void;
  selectByDirection: (direction: 1 | -1, autoplay?: boolean) => void;
  selectTrack: (id: string, autoplay?: boolean) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setPlayerVolume: (value: number) => void;
  toggleMute: () => void;
  togglePlay: () => void;
};

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);
const musicPlayerStorageKey = 'fatal-frame.music-player.preferences';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function loadMusicPlayerPreferences() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(musicPlayerStorageKey);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue) as {
      isMuted?: boolean;
      playbackMode?: PlaybackMode;
      volume?: number;
    };

    const volume = typeof parsed.volume === 'number' ? clamp(parsed.volume, 0, 1) : 0.82;
    const playbackMode: PlaybackMode =
      parsed.playbackMode === 'repeat-one' || parsed.playbackMode === 'shuffle' ? parsed.playbackMode : 'sequence';

    return {
      isMuted: Boolean(parsed.isMuted),
      playbackMode,
      volume,
    };
  } catch {
    return null;
  }
}

function buildShuffleQueue(currentIndex: number) {
  const queue = musicTracks
    .map((_, index) => index)
    .filter((index) => index !== currentIndex);

  for (let index = queue.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [queue[index], queue[randomIndex]] = [queue[randomIndex], queue[index]];
  }

  return queue;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const storedPreferences = loadMusicPlayerPreferences();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousPlaybackModeRef = useRef<PlaybackMode>('sequence');
  const shouldAutoplayRef = useRef(false);
  // Shuffle uses a precomputed queue so one round doesn't repeat tracks.
  const shuffleHistoryRef = useRef<number[]>([]);
  const shuffleQueueRef = useRef<number[]>([]);
  const [selectedId, setSelectedId] = useState(musicTracks[0]?.id ?? '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(storedPreferences?.volume ?? 0.82);
  const [isMuted, setIsMuted] = useState(storedPreferences?.isMuted ?? false);
  const [hasError, setHasError] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>(storedPreferences?.playbackMode ?? 'sequence');

  const selectedTrack = useMemo(
    () => musicTracks.find((track) => track.id === selectedId) ?? musicTracks[0],
    [selectedId],
  );
  const selectedIndex = selectedTrack ? musicTracks.findIndex((track) => track.id === selectedTrack.id) : -1;
  const safeSelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const canMove = musicTracks.length > 1;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumeProgress = isMuted ? 0 : volume * 100;

  const resetShuffleState = useCallback((currentIndex: number) => {
    shuffleHistoryRef.current = [];
    shuffleQueueRef.current = buildShuffleQueue(currentIndex);
  }, []);

  const clearShuffleState = useCallback(() => {
    shuffleHistoryRef.current = [];
    shuffleQueueRef.current = [];
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.volume = volume;
    audio.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        musicPlayerStorageKey,
        JSON.stringify({
          isMuted,
          playbackMode,
          volume,
        }),
      );
    } catch {
      return;
    }
  }, [isMuted, playbackMode, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !selectedTrack) {
      return;
    }

    audio.pause();
    audio.load();
    setCurrentTime(0);
    setDuration(0);
    setHasError(false);
    setIsPlaying(false);

    const shouldPlay = shouldAutoplayRef.current;
    shouldAutoplayRef.current = false;

    if (!shouldPlay) {
      return;
    }

    const playWhenReady = () => {
      void audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    };

    if (audio.readyState >= 2) {
      playWhenReady();
      return;
    }

    audio.addEventListener('canplay', playWhenReady, { once: true });

    return () => audio.removeEventListener('canplay', playWhenReady);
  }, [selectedTrack]);

  const playAudio = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setHasError(false);

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  }, []);

  const pauseAudio = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pauseAudio();
      return;
    }

    void playAudio();
  }, [isPlaying, pauseAudio, playAudio]);

  const selectTrackInternal = useCallback(
    (id: string, autoplay = isPlaying, resetShuffleQueue = true) => {
      shouldAutoplayRef.current = autoplay;
      setSelectedId(id);

      if (!resetShuffleQueue || playbackMode !== 'shuffle') {
        return;
      }

      const nextIndex = musicTracks.findIndex((track) => track.id === id);
      resetShuffleState(nextIndex >= 0 ? nextIndex : safeSelectedIndex);
    },
    [isPlaying, playbackMode, resetShuffleState, safeSelectedIndex],
  );

  const selectTrack = useCallback(
    (id: string, autoplay = isPlaying) => {
      selectTrackInternal(id, autoplay, true);
    },
    [isPlaying, selectTrackInternal],
  );

  useEffect(() => {
    if (previousPlaybackModeRef.current === playbackMode) {
      return;
    }

    previousPlaybackModeRef.current = playbackMode;

    if (playbackMode === 'shuffle') {
      resetShuffleState(safeSelectedIndex);
      return;
    }

    clearShuffleState();
  }, [clearShuffleState, playbackMode, resetShuffleState, safeSelectedIndex]);

  const getNextIndex = useCallback(
    (direction: 1 | -1) => {
      if (!canMove) {
        return safeSelectedIndex;
      }

      if (playbackMode === 'shuffle') {
        if (direction === -1 && shuffleHistoryRef.current.length === 0) {
          return safeSelectedIndex;
        }

        if (direction === -1 && shuffleHistoryRef.current.length > 0) {
          const previousIndex = shuffleHistoryRef.current.pop();

          if (previousIndex !== undefined) {
            shuffleQueueRef.current.unshift(safeSelectedIndex);
            return previousIndex;
          }
        }

        if (!shuffleQueueRef.current.length) {
          shuffleQueueRef.current = buildShuffleQueue(safeSelectedIndex);
        }

        const nextIndex = shuffleQueueRef.current.shift();
        if (nextIndex === undefined) {
          return safeSelectedIndex;
        }

        shuffleHistoryRef.current.push(safeSelectedIndex);
        return nextIndex;
      }

      return (safeSelectedIndex + direction + musicTracks.length) % musicTracks.length;
    },
    [canMove, playbackMode, safeSelectedIndex],
  );

  const selectByDirection = useCallback(
    (direction: 1 | -1, autoplay = true) => {
      const nextTrack = musicTracks[getNextIndex(direction)];
      if (nextTrack) {
        selectTrackInternal(nextTrack.id, autoplay, false);
      }
    },
    [getNextIndex, selectTrackInternal],
  );

  const seekTo = useCallback(
    (value: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(value)) {
        return;
      }

      const mediaDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const seekableDuration = audio.seekable.length ? audio.seekable.end(audio.seekable.length - 1) : 0;
      const maxDuration = duration || mediaDuration || seekableDuration || value;
      const nextTime = clamp(value, 0, maxDuration);

      if (duration <= 0 && maxDuration > 0) {
        setDuration(maxDuration);
      }

      audio.currentTime = nextTime;
      setCurrentTime(audio.currentTime);
    },
    [duration],
  );

  const setPlayerVolume = useCallback((value: number) => {
    const nextVolume = clamp(value, 0, 1);
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  }, []);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      if (volume === 0) {
        setVolume(0.5);
      }
      return;
    }

    setIsMuted(true);
  }, [isMuted, volume]);

  const handleEnded = useCallback(() => {
    if (playbackMode === 'repeat-one') {
      seekTo(0);
      void playAudio();
      return;
    }

    if (canMove) {
      selectByDirection(1, true);
      return;
    }

    setIsPlaying(false);
  }, [canMove, playbackMode, playAudio, seekTo, selectByDirection]);

  const value = useMemo<MusicPlayerContextValue>(
    () => ({
      canMove,
      currentTime,
      duration,
      hasError,
      isMuted,
      isPlaying,
      playbackMode,
      progress,
      selectedIndex: safeSelectedIndex,
      selectedTrack,
      tracks: musicTracks,
      volume,
      volumeProgress,
      pauseAudio,
      playAudio,
      seekTo,
      selectByDirection,
      selectTrack,
      setPlaybackMode,
      setPlayerVolume,
      toggleMute,
      togglePlay,
    }),
    [
      canMove,
      currentTime,
      duration,
      hasError,
      isMuted,
      isPlaying,
      pauseAudio,
      playbackMode,
      playAudio,
      progress,
      safeSelectedIndex,
      seekTo,
      selectByDirection,
      selectTrack,
      selectedTrack,
      setPlayerVolume,
      toggleMute,
      togglePlay,
      volume,
      volumeProgress,
    ],
  );

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
      {selectedTrack ? (
        <audio
          hidden
          ref={audioRef}
          preload="metadata"
          onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
          onEnded={handleEnded}
          onError={() => {
            setHasError(true);
            setIsPlaying(false);
          }}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        >
          <source src={selectedTrack.src} type={selectedTrack.type} />
        </audio>
      ) : null}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error('useMusicPlayer must be used inside MusicPlayerProvider');
  }

  return context;
}
