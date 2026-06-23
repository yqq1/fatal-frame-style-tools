import { Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MuseumWork } from '../data/fatalFrameMuseum';

type WorkDraft = {
  title: string;
  aliases: string;
  latestVersion: string;
  year: string;
  summary: string;
  spoilerSummary: string;
  tags: string;
  cover: string;
  videoIds: string;
  musicIds: string;
};

type MuseumEditorProps = {
  isSaving: boolean;
  work: MuseumWork;
  onClose: () => void;
  onSave: (work: MuseumWork) => Promise<void>;
};

function linesToText(value: string[]) {
  return value.join('\n');
}

function textToLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function getWorkDraft(work: MuseumWork): WorkDraft {
  return {
    title: work.title,
    aliases: linesToText(work.aliases),
    latestVersion: work.latestVersion,
    year: String(work.year),
    summary: work.summary,
    spoilerSummary: work.spoilerSummary,
    tags: linesToText(work.tags),
    cover: work.cover,
    videoIds: linesToText(work.videoIds),
    musicIds: linesToText(work.musicIds),
  };
}

function buildWorkFromDraft(work: MuseumWork, draft: WorkDraft): MuseumWork {
  const year = Number(draft.year);

  if (!Number.isInteger(year) || year < 1980 || year > 2100) {
    throw new Error('年份需要填写 1980-2100 之间的整数。');
  }

  return {
    ...work,
    title: draft.title.trim() || work.title,
    aliases: textToLines(draft.aliases),
    latestVersion: draft.latestVersion.trim() || '资料条目',
    year,
    summary: draft.summary.trim(),
    spoilerSummary: draft.spoilerSummary.trim(),
    tags: textToLines(draft.tags),
    cover: draft.cover.trim(),
    videoIds: textToLines(draft.videoIds),
    musicIds: textToLines(draft.musicIds),
  };
}

function MuseumEditor({ isSaving, work, onClose, onSave }: MuseumEditorProps) {
  const [draft, setDraft] = useState(() => getWorkDraft(work));
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDraft(getWorkDraft(work));
    setMessage('');
  }, [work]);

  async function saveDraft() {
    try {
      await onSave(buildWorkFromDraft(work, draft));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '资料条目保存失败。');
    }
  }

  return (
    <aside className="museum-editor" aria-label="编辑资料条目">
      <div className="museum-editor-head">
        <div>
          <p className="eyebrow">edit archive</p>
          <h3>编辑资料</h3>
        </div>
        <button type="button" onClick={onClose}>
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <label>
        标题
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
      </label>
      <label>
        最新版本
        <input value={draft.latestVersion} onChange={(event) => setDraft({ ...draft, latestVersion: event.target.value })} />
      </label>
      <label>
        年份
        <input inputMode="numeric" value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} />
      </label>
      <label>
        封面路径
        <input value={draft.cover} onChange={(event) => setDraft({ ...draft, cover: event.target.value })} />
      </label>
      <label>
        别名
        <textarea value={draft.aliases} onChange={(event) => setDraft({ ...draft, aliases: event.target.value })} />
      </label>
      <label>
        标签
        <textarea value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
      </label>
      <label>
        简介
        <textarea value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
      </label>
      <label>
        剧透资料
        <textarea value={draft.spoilerSummary} onChange={(event) => setDraft({ ...draft, spoilerSummary: event.target.value })} />
      </label>
      <label>
        视频 ID
        <textarea value={draft.videoIds} onChange={(event) => setDraft({ ...draft, videoIds: event.target.value })} />
      </label>
      <label>
        音乐 ID
        <textarea value={draft.musicIds} onChange={(event) => setDraft({ ...draft, musicIds: event.target.value })} />
      </label>
      {message ? <p className="museum-message">{message}</p> : null}
      <button className="museum-save-button" type="button" onClick={saveDraft} disabled={isSaving}>
        <Save size={16} aria-hidden="true" />
        保存资料
      </button>
    </aside>
  );
}

export default MuseumEditor;
