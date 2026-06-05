import type { MusicLyricLine } from '../data/music';

export type DraftLyricLine = MusicLyricLine & {
  key: string;
};

export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function makeLyricKey() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function toDraftLines(lines: MusicLyricLine[]) {
  return lines.map((line) => ({
    key: makeLyricKey(),
    time: Number(line.time) || 0,
    ja: line.ja || '',
    zh: line.zh || '',
  }));
}

export function cleanDraftLine(line: DraftLyricLine): MusicLyricLine {
  const ja = line.ja.trim();
  const zh = line.zh?.trim() || '';
  return {
    time: Math.max(0, Math.round(Number(line.time || 0) * 1000) / 1000),
    ja: ja || zh,
    ...(zh ? { zh } : {}),
  };
}

export function formatLyricTime(value: number) {
  if (!Number.isFinite(value)) {
    return '00:00.000';
  }

  const safe = Math.max(0, value);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const millis = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function parseLyricSeconds(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? Math.max(0, Math.round(next * 1000) / 1000) : 0;
}
