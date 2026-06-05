# AGENTS.md

## Environment
- Windows workspace. Run terminal commands with `rtk`.
- Read files through shell commands with `rtk`; specify encoding for text reads.
- Preferred read form: `rtk powershell -NoProfile -Command "Get-Content -LiteralPath 'path' -Encoding UTF8"`.
- If UTF-8 is garbled, retry `Default`, then `Unicode`.

## Project
- React + Vite + TypeScript SPA served by a small Node `http` server.
- Scripts: `rtk npm run dev`, `rtk npm run build`, `rtk npm run preview`, `rtk npm run start`.
- Core files: `src/main.tsx`, `src/App.tsx`, `src/App.css`, `server.mjs`.
- Audio tools: `WhisperWorkbench`, `DemucsWorkbench`, `LyricTimingWorkbench`, `MusicView`.
- Generated lyrics live in `src/data/generatedMusicLyrics.ts`; track metadata lives in `src/data/music.ts`.

## Editing Rules
- Prefer small local edits; keep existing component/CSS patterns.
- Use `apply_patch` for manual edits.
- Do not revert user changes.
- Do not add auth, database, UI libraries, broad refactors, or unrelated docs unless requested.
- Preserve the dark crimson butterfly / old-house / viewfinder style.
- Use existing `lucide-react` and `gsap`; clean up GSAP with `gsap.context()` and respect `prefers-reduced-motion`.

## Verification
- Run `rtk npm run build` after frontend/code changes.
- Run `rtk node --check server.mjs` after server/API changes.
- Git remote: `origin https://github.com/yqq1/fatal-frame-style-tools.git`.
