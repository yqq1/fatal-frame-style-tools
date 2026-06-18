import gsap from 'gsap';
import type { RefObject } from 'react';
import { useLayoutEffect } from 'react';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type MusicMotionOptions = {
  activeLyricIndex: number;
  isPlaying: boolean;
  lyricPulseKey: number;
  selectedTrackId: string;
};

function useMusicMotion(
  rootRef: RefObject<HTMLElement | null>,
  { activeLyricIndex, isPlaying, lyricPulseKey, selectedTrackId }: MusicMotionOptions,
) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll('[data-music-motion="panel"]'),
        { y: 18, autoAlpha: 0, scale: 0.985 },
        {
          y: 0,
          autoAlpha: 1,
          scale: 1,
          duration: 0.46,
          ease: 'power3.out',
          stagger: 0.065,
          clearProps: 'transform,visibility',
        },
      );

      gsap.fromTo(
        root.querySelectorAll('.music-orbit-line'),
        { scaleX: 0.62, autoAlpha: 0 },
        {
          scaleX: 1,
          autoAlpha: 0.8,
          duration: 0.58,
          ease: 'power3.out',
          stagger: 0.045,
          clearProps: 'transform,visibility',
        },
      );

      const selectedItem = root.querySelector('.music-item.selected');
      if (selectedItem) {
        gsap.fromTo(
          selectedItem,
          { x: -8, autoAlpha: 0.78 },
          {
            x: 0,
            autoAlpha: 1,
            duration: 0.26,
            ease: 'power3.out',
            overwrite: 'auto',
            clearProps: 'transform,visibility',
          },
        );
      }
    }, root);

    return () => context.revert();
  }, [rootRef, selectedTrackId]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      const pulseTargets = root.querySelectorAll('.music-butterfly-mark, .music-orbit-core, .music-wave-row i');
      if (!pulseTargets.length) {
        return;
      }

      const tween = isPlaying
        ? gsap.to(pulseTargets, {
            scale: (index) => (index % 2 === 0 ? 1.08 : 0.92),
            autoAlpha: (index) => (index % 2 === 0 ? 1 : 0.74),
            duration: 1.18,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            stagger: { each: 0.04, from: 'center' },
          })
        : gsap.to(pulseTargets, {
            scale: 1,
            autoAlpha: 0.78,
            duration: 0.28,
            ease: 'power2.out',
            overwrite: 'auto',
            clearProps: 'transform',
          });

      return () => tween.kill();
    }, root);

    return () => context.revert();
  }, [isPlaying, rootRef]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      const activeLine = root.querySelector('.music-lyric-line.active');
      const activeTranslation = activeLine?.querySelector('.music-lyric-zh');

      if (!activeLine) {
        return;
      }

      gsap.fromTo(
        activeLine,
        { y: 12, scale: 0.985 },
        { y: 0, scale: 1, duration: 0.3, ease: 'power3.out', overwrite: 'auto', clearProps: 'transform' },
      );

      if (activeTranslation) {
        gsap.fromTo(
          activeTranslation,
          { y: 7, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.28, delay: 0.08, ease: 'power2.out', overwrite: 'auto', clearProps: 'transform,visibility' },
        );
      }
    }, root);

    return () => context.revert();
  }, [activeLyricIndex, lyricPulseKey, rootRef]);
}

export default useMusicMotion;
