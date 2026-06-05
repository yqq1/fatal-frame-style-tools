# AGENTS.md

## Environment
- Windows project. Run every terminal command with `rtk`.
- Read files only through shell commands with `rtk`; do not use non-shell file readers.
- For text reads, specify encoding: `rtk powershell -NoProfile -Command "Get-Content -LiteralPath 'path' -Encoding UTF8"`.
- If UTF-8 output is garbled, retry `Default`, then `Unicode`.

## Project
- React + Vite + TypeScript SPA with a small Node `http` server.
- Scripts: `rtk npm run dev`, `rtk npm run build`, `rtk npm run preview`, `rtk npm run start`.
- Main files: `src/main.tsx`, `src/App.tsx`, `src/App.css`, `server.mjs`.
- Audio/music files: `src/components/WhisperWorkbench.tsx`, `src/components/DemucsWorkbench.tsx`, `src/components/LyricTimingWorkbench.tsx`, `src/components/MusicView.tsx`, `src/data/music.ts`, `src/data/generatedMusicLyrics.ts`.
- Notes API stores editable Markdown under `data/notes`.

## Editing Rules
- Prefer small local edits that match existing component and CSS patterns.
- Use `apply_patch` for manual edits.
- Do not revert user changes.
- Do not add auth, database, new UI libraries, unrelated docs, broad refactors, or extra features unless requested.
- Keep styling in the existing dark crimson butterfly / old-house / viewfinder visual language.
- Use existing `lucide-react` and `gsap` patterns; clean up GSAP with context and respect `prefers-reduced-motion`.

## Verification
- Run `rtk npm run build` after code changes.
- For server/API changes, also run `rtk node --check server.mjs`.
