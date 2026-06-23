import { useCallback, useEffect, useMemo, useState } from 'react';
import { musicTracks as staticMusicTracks } from '../data/music';
import type { MusicTrack } from '../data/music';
import { videos as staticVideos } from '../data/videos';
import type { VideoItem } from '../data/videos';

export type RuntimeAudioTrack = MusicTrack & {
  fileName?: string;
  size?: number;
  uploadedAt?: string;
};

export type RuntimeVideoItem = VideoItem & {
  fileName?: string;
  size?: number;
  uploadedAt?: string;
};

export type RuntimeMediaLibraryState = {
  error: string;
  isLoading: boolean;
  musicTracks: MusicTrack[];
  refresh: () => Promise<void>;
  runtimeAudioTracks: RuntimeAudioTrack[];
  runtimeVideos: RuntimeVideoItem[];
  videos: VideoItem[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isRuntimeAudioTrack(value: unknown): value is RuntimeAudioTrack {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.artist === 'string' &&
    typeof value.duration === 'string' &&
    typeof value.src === 'string' &&
    typeof value.type === 'string'
  );
}

function isRuntimeVideo(value: unknown): value is RuntimeVideoItem {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.genre === 'string' &&
    typeof value.duration === 'string' &&
    typeof value.src === 'string'
  );
}

export default function useRuntimeMediaLibrary(): RuntimeMediaLibraryState {
  const [runtimeAudioTracks, setRuntimeAudioTracks] = useState<RuntimeAudioTrack[]>([]);
  const [runtimeVideos, setRuntimeVideos] = useState<RuntimeVideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSourceLibrary, setHasSourceLibrary] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/media/library');
      if (!response.ok) {
        throw new Error('无法读取上传媒体。');
      }

      const data = await response.json();
      const library = isRecord(data.library) ? data.library : {};
      const audio = Array.isArray(library.audio) ? library.audio.filter(isRuntimeAudioTrack) : [];
      const video = Array.isArray(library.video) ? library.video.filter(isRuntimeVideo) : [];

      setRuntimeAudioTracks(audio);
      setRuntimeVideos(video);
      setHasSourceLibrary(true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '无法读取上传媒体。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const musicTracks = useMemo(() => {
    if (!hasSourceLibrary) {
      return staticMusicTracks;
    }

    return runtimeAudioTracks.map((track) => {
      const staticTrack = staticMusicTracks.find((item) => item.id === track.id);
      return staticTrack
        ? {
            ...staticTrack,
            ...track,
            lyrics: staticTrack.lyrics ?? track.lyrics,
          }
        : track;
    });
  }, [hasSourceLibrary, runtimeAudioTracks]);

  const videos = useMemo(() => {
    if (!hasSourceLibrary) {
      return staticVideos;
    }

    return runtimeVideos.map((video) => {
      const staticVideo = staticVideos.find((item) => item.id === video.id);
      return staticVideo ? { ...staticVideo, ...video } : video;
    });
  }, [hasSourceLibrary, runtimeVideos]);

  return {
    error,
    isLoading,
    musicTracks,
    refresh,
    runtimeAudioTracks,
    runtimeVideos,
    videos,
  };
}
