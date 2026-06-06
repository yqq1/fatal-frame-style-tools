import { useEffect, useState } from 'react';
import type { MusicLyricLine } from '../data/music';

function isRuntimeLyricsMap(value: unknown): value is Record<string, MusicLyricLine[]> {
  return Boolean(value && typeof value === 'object');
}

export default function useRuntimeMusicLyrics() {
  const [runtimeLyrics, setRuntimeLyrics] = useState<Record<string, MusicLyricLine[]>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadRuntimeLyrics() {
      try {
        const response = await fetch('/api/music/generated-lyrics');
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (!cancelled && isRuntimeLyricsMap(data.lyrics)) {
          setRuntimeLyrics(data.lyrics);
        }
      } catch {
        return;
      }
    }

    loadRuntimeLyrics();

    return () => {
      cancelled = true;
    };
  }, []);

  return runtimeLyrics;
}
