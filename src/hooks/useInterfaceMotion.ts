import gsap from 'gsap';
import type { DependencyList, RefObject } from 'react';
import { useLayoutEffect } from 'react';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useInterfaceMotion(rootRef: RefObject<HTMLElement>, dependencies: DependencyList) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      const panelTargets = root.querySelectorAll('[data-motion="panel"]');
      const itemTargets = root.querySelectorAll('[data-motion="item"]:not(.music-item):not(.video-item)');
      const focusTargets = root.querySelectorAll('[data-motion="focus-line"]');
      const viewfinderTargets = root.querySelectorAll('.viewfinder span');
      const timeline = gsap.timeline({
        defaults: { ease: 'power3.out' },
      });

      timeline
        .from(
          root.querySelectorAll('[data-motion="topbar"] > *'),
          { y: -8, duration: 0.28, stagger: 0.04, clearProps: 'transform' },
        )
        .from(
          panelTargets,
          { y: 18, autoAlpha: 0, scale: 0.988, duration: 0.34, stagger: 0.055, clearProps: 'transform,visibility' },
          '-=0.18',
        )
        .from(
          itemTargets,
          { y: 10, autoAlpha: 0, duration: 0.28, stagger: 0.035, clearProps: 'transform,visibility' },
          '-=0.18',
        )
        .from(
          [...viewfinderTargets, ...focusTargets],
          { scaleX: 0.45, scaleY: 0.7, autoAlpha: 0, duration: 0.24, stagger: 0.025, clearProps: 'transform,visibility' },
          '-=0.22',
        );
    }, root);

    return () => context.revert();
  }, dependencies);
}

export default useInterfaceMotion;
