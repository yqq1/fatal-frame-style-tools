import type { MusicLyricLine } from '../data/music';
import type { DraftLyricLine } from '../lib/lyricTiming';
import { formatLyricTime, parseLyricSeconds } from '../lib/lyricTiming';

type LyricTimingRowProps = {
  index: number;
  isSelected: boolean;
  line: DraftLyricLine;
  onPatch: (key: string, patch: Partial<MusicLyricLine>) => void;
  onSeek: (time: number) => void;
  onSelect: (key: string) => void;
};

function estimateRows(value: string) {
  const lines = value.split(/\r?\n/);
  const wrapped = lines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 32)), 0);
  return Math.min(8, Math.max(2, wrapped));
}

export default function LyricTimingRow({
  index,
  isSelected,
  line,
  onPatch,
  onSeek,
  onSelect,
}: LyricTimingRowProps) {
  return (
    <article
      className={`lyric-timing-row ${isSelected ? 'selected' : ''}`}
      data-line-key={line.key}
      onClick={() => onSelect(line.key)}
    >
      <button className="lyric-timing-row-time" type="button" onClick={() => onSeek(line.time)}>
        <span>#{index + 1}</span>
        <strong>{formatLyricTime(line.time)}</strong>
      </button>
      <div className="lyric-timing-line-fields">
        <label>
          <span>time</span>
          <input
            value={line.time}
            inputMode="decimal"
            onChange={(event) => onPatch(line.key, { time: parseLyricSeconds(event.target.value) })}
          />
        </label>
        <label>
          <span>ja</span>
          <textarea value={line.ja} rows={estimateRows(line.ja)} onChange={(event) => onPatch(line.key, { ja: event.target.value })} />
        </label>
        <label>
          <span>zh</span>
          <textarea value={line.zh || ''} rows={estimateRows(line.zh || '')} onChange={(event) => onPatch(line.key, { zh: event.target.value })} />
        </label>
      </div>
    </article>
  );
}
