# HANDOFF.md

## Current Task
Regenerated project handoff files from current code. Last active work was polishing audio tool UI, especially lyric timing controls and progress styling.

## Confirmed Facts
- Project is a React + Vite + TypeScript SPA served by `server.mjs`.
- Audio tools currently wired in `src/App.tsx`: `Whisper 转写`, `歌词校时`, `Demucs 人声分离`; other tool cards are placeholders.
- `server.mjs` exposes `/api/notes`, `/api/whisper`, `/api/demucs`, and `/api/music/generated-lyrics`.
- Whisper defaults include model dir `D:\ce_study\WhisperModels`; output is constrained to `data/whisper-outputs`.
- Demucs defaults to `C:\Users\ADMIN\AppData\Local\Programs\Python\Python312\Scripts\demucs.exe`; output is constrained to `data/demucs-outputs`.
- Generated lyrics are stored in `src/data/generatedMusicLyrics.ts`; `music.ts` merges generated lyrics into tracks when no static lyrics exist.
- Audio/video progress indicators use the crimson butterfly asset from `src/assets/crimson-butterfly-real.png`.

## Priority Files
- `AGENTS.md`
- `package.json`
- `server.mjs`
- `src/App.tsx`
- `src/App.css`
- `src/components/WhisperWorkbench.tsx`
- `src/components/DemucsWorkbench.tsx`
- `src/components/LyricTimingWorkbench.tsx`
- `src/components/CrimsonSelect.tsx`
- `src/data/music.ts`

## Recent Decisions
- Demucs can pass `vocals.wav` into Whisper by pre-filling the Whisper local path; it does not auto-start Whisper.
- Lyric timing edits are drafts until saved through `PUT /api/music/generated-lyrics/:trackId`.
- Lyric timing "音频与操作" panel is sticky on non-mobile layouts and normal flow on mobile.
- Lyric timing and music progress thumbs use the red butterfly indicator; native range thumbs are hidden.
- Compact `CrimsonSelect` hides vertical scrollbar, keeps horizontal scrolling, and uses an inner options layer to avoid hover background clipping.

## Verification
- Last known check: `rtk npm run build` passed after progress indicator and sticky lyric timing changes.
- Run `rtk node --check server.mjs` after future server edits.

## Risks / Follow-up
- Server job state for Whisper/Demucs is in memory only; restarting loses job status, not output files.
- Notes API has no auth.
- Local Whisper/Demucs availability depends on the user's Python environment and installed packages.
