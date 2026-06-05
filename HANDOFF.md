# HANDOFF.md

## Current State
- Project has been pushed to GitHub on `main`: `yqq1/fatal-frame-style-tools.git`.
- `public/videos/` is intentionally ignored and not committed; video files must be supplied separately on deployment if the video page is needed.
- `dist/` is ignored. User deploys by copying built `dist` plus server/runtime files to the server, not by pulling/building from Git.

## Confirmed Facts
- `server.mjs` serves `dist` and APIs for notes, Whisper, Demucs, generated lyrics, and storage cleanup.
- Dockerfile expects these paths in the server project directory: `dist/`, `server.mjs`, `data/notes/`, `src/data/`.
- `src/data` is required at runtime because `server.mjs` reads `src/data/generatedMusicLyrics.ts` and `src/data/music.ts`.
- `music.ts` imports `musicLyrics.ts`; copying the whole `src/data/` directory is safest.
- Notes runtime directory is `/app/data/notes`; `data/notes` copied into the image is only seed data.
- Storage cleanup API: automatic cleanup uses 48-hour TTL and 3 GiB cap; settings-page button clears all unprotected managed temp files.

## Deployment Notes
- Minimum server project layout:
  - `dist/`
  - `server.mjs`
  - `Dockerfile`
  - `data/notes/`
  - `src/data/generatedMusicLyrics.ts`
  - `src/data/music.ts`
  - `src/data/musicLyrics.ts`
- Dockerfile should include `COPY src/data ./src/data`.
- If mounting generated lyrics for persistence, the host path must be a file, not a directory:
  - Good: `/data/fatal-frame/generatedMusicLyrics.ts` is a real file.
  - Bad: Docker auto-created `/data/fatal-frame/generatedMusicLyrics.ts/` as a directory.
- To fix a bad mount on the server:
  - `rm -rf /data/fatal-frame/generatedMusicLyrics.ts`
  - `mkdir -p /data/fatal-frame`
  - `cp ./src/data/generatedMusicLyrics.ts /data/fatal-frame/generatedMusicLyrics.ts`
- If no persistence is needed, remove the file mount and rely on `COPY src/data ./src/data`.

## Priority Files
- `server.mjs`
- `Dockerfile`
- `docker-compose.yml`
- `src/App.tsx`
- `src/App.css`
- `src/components/WhisperWorkbench.tsx`
- `src/components/DemucsWorkbench.tsx`
- `src/components/LyricTimingWorkbench.tsx`
- `src/data/music.ts`
- `src/data/generatedMusicLyrics.ts`

## Risks / Remaining Work
- Server-side Whisper/Demucs inside Docker is not configured for Python/CUDA; current Docker deployment is mainly for the web UI and Node APIs.
- `src/data/generatedMusicLyrics.ts` changes made in the running container are lost on rebuild unless mounted to a real host file.
- No auth is implemented for notes, lyrics, cleanup, Whisper, or Demucs APIs.
