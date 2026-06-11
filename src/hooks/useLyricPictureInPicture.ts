import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';

function isLyricPipAvailable() {
  return Boolean(window.documentPictureInPicture);
}

function getLyricPipUnavailableReason() {
  if (!window.isSecureContext) {
    return '字幕小窗需要 HTTPS 或 localhost 环境';
  }

  if (!window.documentPictureInPicture) {
    return '当前浏览器不支持字幕小窗，请使用桌面版 Chrome 或 Edge';
  }

  return '';
}

function writeLyricPipDocument(pipWindow: Window) {
  pipWindow.document.open();
  pipWindow.document.write(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <style>
      :root {
        color-scheme: dark;
        --ink: #fff5e8;
        --paper: #d6b59b;
        --blood: #8d1b22;
        --deep: #100707;
      }

      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        color: var(--ink);
        background:
          radial-gradient(circle at 24% 0%, rgba(142, 30, 36, 0.34), transparent 38%),
          linear-gradient(180deg, rgba(31, 16, 15, 0.98), rgba(8, 4, 5, 0.99));
        user-select: none;
      }

      body {
        display: grid;
        place-items: center;
        font-family: "Yu Gothic", "Microsoft YaHei", "Meiryo", sans-serif;
      }

      .pip-lyric {
        position: relative;
        display: grid;
        width: calc(100vw - 30px);
        min-height: calc(100vh - 26px);
        place-items: center;
        padding: 16px 18px 18px;
        box-sizing: border-box;
        border: 1px solid rgba(160, 58, 50, 0.42);
        border-radius: 10px;
        background:
          linear-gradient(90deg, rgba(255, 246, 230, 0.06) 1px, transparent 1px),
          linear-gradient(0deg, rgba(255, 246, 230, 0.04) 1px, transparent 1px),
          radial-gradient(circle at 50% 20%, rgba(150, 26, 32, 0.18), transparent 56%),
          rgba(15, 8, 8, 0.58);
        background-size: 28px 28px, 28px 28px, auto, auto;
        box-shadow:
          inset 0 0 0 1px rgba(255, 226, 190, 0.05),
          inset 0 0 46px rgba(0, 0, 0, 0.62),
          0 0 34px rgba(111, 13, 19, 0.42);
      }

      .pip-lyric::before,
      .pip-lyric::after {
        position: absolute;
        width: 42px;
        height: 42px;
        content: "";
        pointer-events: none;
      }

      .pip-lyric::before {
        top: 10px;
        left: 10px;
        border-top: 1px solid rgba(228, 166, 130, 0.52);
        border-left: 1px solid rgba(228, 166, 130, 0.52);
      }

      .pip-lyric::after {
        right: 10px;
        bottom: 10px;
        border-right: 1px solid rgba(228, 166, 130, 0.52);
        border-bottom: 1px solid rgba(228, 166, 130, 0.52);
      }

      .pip-lyric-tag {
        position: absolute;
        top: 10px;
        right: 16px;
        color: rgba(218, 180, 150, 0.58);
        font-size: 10px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
      }

      .pip-lyric-lines {
        display: grid;
        width: min(92vw, 720px);
        gap: 9px;
        place-items: center;
      }

      .pip-lyric-line {
        width: 100%;
        margin: 0;
        overflow: hidden;
        font-weight: 800;
        letter-spacing: 0.035em;
        line-height: 1.16;
        text-align: center;
        overflow-wrap: anywhere;
        white-space: normal;
        text-shadow:
          -2px -2px 0 #080303,
          2px -2px 0 #080303,
          -2px 2px 0 #080303,
          2px 2px 0 #080303,
          0 0 10px rgba(93, 0, 6, 0.94),
          0 0 24px rgba(170, 24, 28, 0.62);
      }

      .pip-lyric-ja {
        color: #fff6ea;
        font-size: clamp(24px, 7.4vw, 40px);
      }

      .pip-lyric-zh {
        color: #f1cdb3;
        font-size: clamp(17px, 4.8vw, 27px);
      }

      .pip-lyric-zh:empty {
        display: none;
      }
    </style>
  </head>
  <body>
    <main class="pip-lyric" aria-live="polite">
      <span class="pip-lyric-tag">lyric viewer</span>
      <div class="pip-lyric-lines">
        <p class="pip-lyric-line pip-lyric-ja" data-ja></p>
        <p class="pip-lyric-line pip-lyric-zh" data-zh></p>
      </div>
    </main>
  </body>
</html>`);
  pipWindow.document.close();
}

function updateLyricPipWindow(pipWindow: Window, ja: string, zh: string) {
  const root = pipWindow.document.querySelector('.pip-lyric-lines');
  const lines = pipWindow.document.querySelectorAll('.pip-lyric-line');
  const jaNode = pipWindow.document.querySelector('[data-ja]');
  const zhNode = pipWindow.document.querySelector('[data-zh]');

  if (!root || !jaNode || !zhNode) {
    return;
  }

  const changed = jaNode.textContent !== ja || zhNode.textContent !== zh;
  jaNode.textContent = ja;
  zhNode.textContent = zh;

  gsap.killTweensOf(lines);

  if (!changed || pipWindow.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    gsap.set(lines, { autoAlpha: 1, filter: 'blur(0px)', y: 0 });
    return;
  }

  gsap.fromTo(
    lines,
    { y: 9, autoAlpha: 0, filter: 'blur(3px)' },
    {
      y: 0,
      autoAlpha: 1,
      filter: 'blur(0px)',
      duration: 0.34,
      ease: 'power3.out',
      stagger: 0.035,
      overwrite: 'auto',
      clearProps: 'transform,filter,opacity,visibility',
    },
  );
}

export default function useLyricPictureInPicture(ja: string, zh: string) {
  const pipWindowRef = useRef<Window | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const isAvailable = isLyricPipAvailable();
  const unavailableReason = isAvailable ? '' : getLyricPipUnavailableReason();

  useEffect(() => {
    const pipWindow = pipWindowRef.current;
    if (!pipWindow || pipWindow.closed) {
      return;
    }

    updateLyricPipWindow(pipWindow, ja, zh);
  }, [ja, zh]);

  async function toggle() {
    const existingWindow = pipWindowRef.current;
    if (existingWindow && !existingWindow.closed) {
      existingWindow.close();
      pipWindowRef.current = null;
      setIsOpen(false);
      return;
    }

    if (!window.documentPictureInPicture) {
      return;
    }

    const pipWindow = await window.documentPictureInPicture.requestWindow({
      height: 188,
      width: 720,
    });

    pipWindowRef.current = pipWindow;
    setIsOpen(true);
    writeLyricPipDocument(pipWindow);
    updateLyricPipWindow(pipWindow, ja, zh);

    pipWindow.addEventListener('pagehide', () => {
      pipWindowRef.current = null;
      setIsOpen(false);
    });
  }

  return {
    isAvailable,
    isOpen,
    toggle,
    unavailableReason,
  };
}
