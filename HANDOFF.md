# HANDOFF.md

## Current Task
- Implementing browser-based synced lyrics Picture-in-Picture for the music player.
- User explicitly abandoned Electron/desktop implementation.
- Pure web PiP cannot remove the browser/PiP title bar or support click-through.

## Current State
- Working tree has uncommitted changes for music PiP and volume controls.
- `rtk npm run build` passed after the latest changes.
- No README file exists in the project root.

## Changed Files
- `src/App.tsx`: wraps app content in `LyricPictureInPictureProvider` inside `MusicPlayerProvider`.
- `src/components/MusicView.tsx`: music player owns the “字幕小窗” button; volume control uses a popover slider. When popover is closed, clicking volume opens it; when open, clicking volume toggles mute/restore; outside click closes it.
- `src/hooks/useLyricPictureInPicture.ts`: browser `documentPictureInPicture` window, restored to prior dark crimson viewfinder PiP content style, with GSAP lyric transition.
- `src/context/LyricPictureInPictureContext.tsx`: keeps PiP lyric sync global while audio keeps playing.
- `src/hooks/useRuntimeMusicLyrics.ts`: loads runtime generated lyrics from `/api/music/generated-lyrics`.
- `src/lib/musicLyricSync.ts`: shared active lyric line/index helpers.
- `src/vite-env.d.ts`: declares `documentPictureInPicture` browser API.
- `src/App.css`: music controls, lyric PiP button, and volume popover styles.

## Decisions
- PiP button belongs on the full music player, not the mini player.
- Mini player should not include subtitle/PiP controls.
- No Electron dependency or desktop scripts should be added.
- PiP window content should use the restored previous dark crimson viewfinder style; do not restyle it from prose descriptions unless asked.
- The browser/PiP chrome shown above the window is not page content and cannot be removed in pure web.

## Priority Files
- `src/components/MusicView.tsx`
- `src/hooks/useLyricPictureInPicture.ts`
- `src/context/LyricPictureInPictureContext.tsx`
- `src/hooks/useRuntimeMusicLyrics.ts`
- `src/lib/musicLyricSync.ts`
- `src/App.css`
- `src/App.tsx`

## Risks / Remaining Work
- PiP support depends on Chromium `documentPictureInPicture`; unsupported browsers will not show the subtitle-window button.
- Visual QA in the browser has not been performed in this handoff; only build verification is confirmed.
- Existing deployment facts still apply: `dist/` is ignored; server deployment copies built `dist` plus runtime files, and `src/data` is required at runtime by `server.mjs`.
