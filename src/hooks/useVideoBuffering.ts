import { type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';

export type VideoBufferMode = 'stream' | 'session-cache';
export type VideoBufferStatus = 'idle' | 'prebuffering' | 'playing' | 'rebuffering' | 'caching' | 'cached' | 'failed';

type SessionVideoCache = {
  byteLength: number;
  contentType: string;
  objectUrl: string;
  sourceUrl: string;
};

type UseVideoBufferingOptions = {
  isMobile: boolean;
  mode: VideoBufferMode;
  onSessionCacheReady: (shouldPlay: boolean) => void;
  sourceUrl: string;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
};

const INITIAL_BUFFER_SECONDS = 8;
const LOW_BUFFER_SECONDS = 2;
const MOBILE_SESSION_CACHE_LIMIT = 128 * 1024 * 1024;
const DESKTOP_SESSION_CACHE_LIMIT = 256 * 1024 * 1024;

export function getBufferedAhead(video: HTMLVideoElement) {
  const { buffered, currentTime } = video;

  for (let index = 0; index < buffered.length; index += 1) {
    const start = buffered.start(index);
    const end = buffered.end(index);

    if (currentTime >= start - 0.05 && currentTime <= end + 0.05) {
      return Math.max(0, end - currentTime);
    }
  }

  return 0;
}

function getTargetBuffer(video: HTMLVideoElement, target: number) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    return target;
  }

  return Math.max(1, Math.min(target, video.duration - video.currentTime));
}

function getCacheErrorMessage(error: unknown, cacheLimit: number) {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return `无法完整缓存当前视频，请改用流式模式或小于 ${Math.round(cacheLimit / 1024 / 1024)} MiB 的清晰度。`;
}

export default function useVideoBuffering({
  isMobile,
  mode,
  onSessionCacheReady,
  sourceUrl,
  videoRef,
}: UseVideoBufferingOptions) {
  const [bufferedAhead, setBufferedAhead] = useState(0);
  const [cacheBytes, setCacheBytes] = useState(0);
  const [cacheProgress, setCacheProgress] = useState(0);
  const [cacheTotalBytes, setCacheTotalBytes] = useState(0);
  const [message, setMessage] = useState('');
  const [sessionCache, setSessionCache] = useState<SessionVideoCache | null>(null);
  const [status, setStatus] = useState<VideoBufferStatus>('idle');
  const cacheRef = useRef<SessionVideoCache | null>(null);
  const downloadControllerRef = useRef<AbortController | null>(null);
  const onSessionCacheReadyRef = useRef(onSessionCacheReady);
  const rebufferCountRef = useRef(0);
  const sourceRef = useRef(sourceUrl);
  const userPausedRef = useRef(false);
  const wantsPlaybackRef = useRef(false);

  onSessionCacheReadyRef.current = onSessionCacheReady;

  const cacheLimitBytes = isMobile ? MOBILE_SESSION_CACHE_LIMIT : DESKTOP_SESSION_CACHE_LIMIT;
  const playbackSourceUrl = sessionCache?.sourceUrl === sourceUrl ? sessionCache.objectUrl : sourceUrl;
  const isCaching = status === 'caching';
  const isBuffering = status === 'prebuffering' || status === 'rebuffering';

  const clearSessionCache = useCallback(() => {
    const cache = cacheRef.current;
    if (cache) {
      URL.revokeObjectURL(cache.objectUrl);
      cacheRef.current = null;
    }

    setSessionCache(null);
  }, []);

  const cancelSessionCache = useCallback(() => {
    downloadControllerRef.current?.abort();
    downloadControllerRef.current = null;
    setCacheBytes(0);
    setCacheProgress(0);
    setCacheTotalBytes(0);
    setMessage('缓存已取消。');
    setStatus('idle');
  }, []);

  const playVideo = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    try {
      await video.play();
      wantsPlaybackRef.current = false;
      setMessage('');
      setStatus(cacheRef.current?.sourceUrl === sourceRef.current ? 'cached' : 'playing');
    } catch {
      setStatus('failed');
      setMessage('浏览器阻止了自动恢复，请再次点击播放。');
    }
  }, [videoRef]);

  const tryResumeStreaming = useCallback(() => {
    const video = videoRef.current;
    if (!video || mode !== 'stream' || !wantsPlaybackRef.current || userPausedRef.current) {
      return;
    }

    if (getBufferedAhead(video) >= getTargetBuffer(video, INITIAL_BUFFER_SECONDS)) {
      void playVideo();
    }
  }, [mode, playVideo, videoRef]);

  const updateBufferedAhead = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    setBufferedAhead(getBufferedAhead(video));
    tryResumeStreaming();
  }, [tryResumeStreaming, videoRef]);

  const cacheCurrentSource = useCallback(
    async (shouldPlay: boolean) => {
      if (!sourceUrl || downloadControllerRef.current) {
        return;
      }

      if (cacheRef.current?.sourceUrl === sourceUrl) {
        if (shouldPlay) {
          userPausedRef.current = false;
          void playVideo();
        }
        return;
      }

      const controller = new AbortController();
      downloadControllerRef.current = controller;
      setCacheBytes(0);
      setCacheProgress(0);
      setCacheTotalBytes(0);
      setMessage('');
      setStatus('caching');

      try {
        const headResponse = await fetch(sourceUrl, {
          cache: 'no-store',
          method: 'HEAD',
          signal: controller.signal,
        });
        const byteLength = Number(headResponse.headers.get('content-length'));

        if (!headResponse.ok || !Number.isFinite(byteLength) || byteLength <= 0) {
          throw new Error('无法读取视频大小，不能安全地完整缓存。');
        }

        if (byteLength > cacheLimitBytes) {
          throw new Error(`当前视频超过 ${Math.round(cacheLimitBytes / 1024 / 1024)} MiB，仅支持流式播放。`);
        }

        setCacheTotalBytes(byteLength);

        const response = await fetch(sourceUrl, {
          cache: 'force-cache',
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('视频下载失败，已保留流式播放源。');
        }

        const reader = response.body.getReader();
        const chunks: ArrayBuffer[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          if (!value) {
            continue;
          }

          received += value.byteLength;
          if (received > cacheLimitBytes) {
            throw new Error(`当前视频超过 ${Math.round(cacheLimitBytes / 1024 / 1024)} MiB，仅支持流式播放。`);
          }

          const chunk = new Uint8Array(value.byteLength);
          chunk.set(value);
          chunks.push(chunk.buffer);
          setCacheBytes(received);
          setCacheProgress(Math.min(1, received / byteLength));
        }

        if (sourceRef.current !== sourceUrl) {
          return;
        }

        const contentType = response.headers.get('content-type') || 'video/mp4';
        const cache: SessionVideoCache = {
          byteLength: received,
          contentType,
          objectUrl: URL.createObjectURL(new Blob(chunks, { type: contentType })),
          sourceUrl,
        };

        clearSessionCache();
        cacheRef.current = cache;
        setSessionCache(cache);
        setCacheProgress(1);
        setStatus('cached');
        onSessionCacheReadyRef.current(shouldPlay);
      } catch (error) {
        const nextMessage = getCacheErrorMessage(error, cacheLimitBytes);
        if (!nextMessage) {
          setStatus('idle');
          return;
        }

        setStatus('failed');
        setMessage(nextMessage);
      } finally {
        if (downloadControllerRef.current === controller) {
          downloadControllerRef.current = null;
        }
      }
    },
    [cacheLimitBytes, clearSessionCache, playVideo, sourceUrl],
  );

  const requestPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    userPausedRef.current = false;

    if (mode === 'session-cache') {
      void cacheCurrentSource(true);
      return;
    }

    updateBufferedAhead();
    if (getBufferedAhead(video) >= getTargetBuffer(video, INITIAL_BUFFER_SECONDS)) {
      void playVideo();
      return;
    }

    wantsPlaybackRef.current = true;
    setMessage('正在预缓存视频。');
    setStatus('prebuffering');

    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      video.load();
    }
  }, [cacheCurrentSource, mode, playVideo, updateBufferedAhead, videoRef]);

  const markUserPaused = useCallback(() => {
    userPausedRef.current = true;
    wantsPlaybackRef.current = false;
    setMessage('');
    setStatus(cacheRef.current?.sourceUrl === sourceRef.current ? 'cached' : 'idle');
  }, []);

  const handleWaiting = useCallback(() => {
    const video = videoRef.current;
    if (!video || mode !== 'stream' || userPausedRef.current || video.ended) {
      return;
    }

    rebufferCountRef.current += 1;
    wantsPlaybackRef.current = true;
    video.pause();
    setMessage('网络波动，正在缓冲。');
    setStatus('rebuffering');
    updateBufferedAhead();
  }, [mode, updateBufferedAhead, videoRef]);

  const handlePlaying = useCallback(() => {
    wantsPlaybackRef.current = false;
    setMessage('');
    setStatus(cacheRef.current?.sourceUrl === sourceRef.current ? 'cached' : 'playing');
    updateBufferedAhead();
  }, [updateBufferedAhead]);

  const handlePause = useCallback(() => {
    if (wantsPlaybackRef.current && !userPausedRef.current) {
      return;
    }

    setStatus(cacheRef.current?.sourceUrl === sourceRef.current ? 'cached' : 'idle');
  }, []);

  const handleEnded = useCallback(() => {
    wantsPlaybackRef.current = false;
    setStatus(cacheRef.current?.sourceUrl === sourceRef.current ? 'cached' : 'idle');
  }, []);

  const handleError = useCallback(() => {
    wantsPlaybackRef.current = false;
    setStatus('failed');
    setMessage('视频加载失败，请检查网络或切换清晰度。');
  }, []);

  useEffect(() => {
    sourceRef.current = sourceUrl;
    downloadControllerRef.current?.abort();
    downloadControllerRef.current = null;
    clearSessionCache();
    rebufferCountRef.current = 0;
    userPausedRef.current = false;
    wantsPlaybackRef.current = false;
    setBufferedAhead(0);
    setCacheBytes(0);
    setCacheProgress(0);
    setCacheTotalBytes(0);
    setMessage('');
    setStatus('idle');
  }, [clearSessionCache, sourceUrl]);

  useEffect(() => {
    return () => {
      downloadControllerRef.current?.abort();
      clearSessionCache();
    };
  }, [clearSessionCache]);

  return {
    bufferedAhead,
    cacheBytes,
    cacheLimitBytes,
    cacheProgress,
    cacheTotalBytes,
    cancelSessionCache,
    clearSessionCache,
    handleBufferEvent: updateBufferedAhead,
    handleEnded,
    handleError,
    handlePause,
    handlePlaying,
    handleWaiting,
    isBuffering,
    isCaching,
    markUserPaused,
    message,
    playbackSourceUrl,
    requestPlayback,
    shouldRecommendLowerQuality: rebufferCountRef.current >= 2,
    status,
  };
}
