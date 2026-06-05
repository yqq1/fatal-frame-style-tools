# AGENTS.md

## Environment
- Windows project.
- All terminal commands must be prefixed with `rtk`.
- All file reads must go through shell with `rtk`.
- Do not use non-shell built-in file readers.

## File Reading
- Prefer minimal, targeted reads.
- Text reads must specify encoding:
  `rtk powershell -NoProfile -Command "Get-Content -LiteralPath 'path' -Encoding UTF8"`
- If UTF-8 output is garbled, retry with `Default`, then `Unicode`.
- Avoid broad repository scans unless necessary.

## Project
- React + Vite + TypeScript SPA with a small Node API.
- Main entry: `src/main.tsx`.
- Main shell/navigation: `src/App.tsx`.
- Main styling: `src/App.css`.
- Node server/API/static hosting: `server.mjs`.
- Editable notes: `src/components/BlogView.tsx`, `src/components/NoteEditor.tsx`, `data/notes`.
- Video player: `src/components/VideoView.tsx`, `src/data/videos.ts`.
- Docker deploy uses prebuilt `dist`; do not build frontend inside the server container.

## Editing
- Prefer small local edits.
- Use existing React component and CSS patterns.
- Use `apply_patch` for manual edits.
- Do not revert user changes.
- Do not add auth, database, upload, video transcoding, or unrelated docs unless requested.

## UI Direction
- Dark, restrained crimson butterfly / old-house atmosphere.
- Keep UI readable; atmosphere belongs in background, borders, motion, and accents.
- Avoid horizontal overflow on mobile.
- Use existing `lucide-react` and `gsap` patterns; do not add UI libraries casually.

## Verification
- Run `rtk npm run build` after code changes.
- For API changes, verify with `rtk npm run start` or `rtk node server.mjs` when feasible.