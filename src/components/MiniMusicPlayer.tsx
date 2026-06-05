import { Music, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import gsap from 'gsap';
import type { CSSProperties } from 'react';
import { useLayoutEffect, useRef } from 'react';
import { useMusicPlayer } from '../context/MusicPlayerContext';

type MiniMusicPlayerProps = {
  onOpenMusic: () => void;
};

function MiniMusicPlayer({ onOpenMusic }: MiniMusicPlayerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const {
    canMove,
    currentTime,
    duration,
    isPlaying,
    progress,
    selectedTrack,
    selectByDirection,
    togglePlay,
  } = useMusicPlayer();

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        root,
        { y: 12, scale: 0.92, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.32, ease: 'power3.out', overwrite: 'auto' },
      );
    }, root);

    return () => context.revert();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !isPlaying || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const context = gsap.context(() => {
      const target = root.querySelector('.mini-player-orb');
      if (!target) {
        return;
      }

      const tween = gsap.to(target, {
        scale: 1.08,
        autoAlpha: 0.82,
        duration: 1.1,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true,
      });

      return () => tween.kill();
    }, root);

    return () => context.revert();
  }, [isPlaying]);

  if (!selectedTrack || (!isPlaying && currentTime <= 0)) {
    return null;
  }

  return (
    <div className={`mini-player ${isPlaying ? 'playing' : 'paused'}`} ref={rootRef} aria-label="迷你音乐播放器">
      <span className="mini-player-orb" aria-hidden="true">
        <Music size={16} aria-hidden="true" />
      </span>
      <button className="mini-player-main" type="button" aria-label={isPlaying ? '暂停音乐' : '播放音乐'} onClick={togglePlay}>
        {isPlaying ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
      </button>
      <div className="mini-player-details">
        <button className="mini-player-title" type="button" onClick={onOpenMusic}>
          <strong>{selectedTrack.title}</strong>
          <span>{selectedTrack.artist}</span>
        </button>
        <div className="mini-player-actions">
          <button type="button" aria-label="上一首" disabled={!canMove} onClick={() => selectByDirection(-1)}>
            <SkipBack size={14} aria-hidden="true" />
          </button>
          <span className="mini-player-progress" style={{ '--mini-progress': `${duration > 0 ? progress : 0}%` } as CSSProperties} />
          <button type="button" aria-label="下一首" disabled={!canMove} onClick={() => selectByDirection(1)}>
            <SkipForward size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MiniMusicPlayer;
