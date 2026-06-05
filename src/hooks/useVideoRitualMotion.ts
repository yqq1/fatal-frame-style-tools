import gsap from 'gsap';
import type { DependencyList, RefObject } from 'react';
import { useLayoutEffect } from 'react';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useVideoRitualMotion(rootRef: RefObject<HTMLElement | null>, dependencies: DependencyList) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      const controls = root.querySelector('.video-controls');
      const controlButtons = root.querySelectorAll('.ritual-control');
      const qualityControls = root.querySelectorAll('.quality-control');
      const marks = root.querySelectorAll('.ritual-control-mark');
      const progressWings = root.querySelectorAll('.progress-butterfly-image');
      const selectedFilm = root.querySelector('.video-item.selected');
      const selectedEqualizer = root.querySelector('.video-item.selected .playing-equalizer');
      const openQualityMenu = root.querySelector('.quality-menu.open');
      const openVolumePanel = root.querySelector('.mobile-volume-panel.open');

      gsap.set(marks, { autoAlpha: 0, scaleY: 0.45, transformOrigin: '50% 50%' });
      gsap.set(progressWings, { transformOrigin: '50% 65%' });

      if (selectedFilm) {
        gsap.fromTo(
          selectedFilm,
          { x: -8, autoAlpha: 0.72 },
          { x: 0, autoAlpha: 1, duration: 0.32, ease: 'power3.out', clearProps: 'transform,visibility' },
        );
      }

      if (selectedEqualizer) {
        gsap.fromTo(
          selectedEqualizer,
          { autoAlpha: 0, scale: 0.72 },
          { autoAlpha: 1, scale: 1, duration: 0.26, ease: 'power2.out' },
        );
      }

      if (openQualityMenu) {
        gsap.fromTo(
          openQualityMenu,
          { y: 8, scale: 0.96, autoAlpha: 0 },
          { y: 0, scale: 1, autoAlpha: 1, duration: 0.2, ease: 'power3.out', overwrite: 'auto' },
        );

        gsap.fromTo(
          openQualityMenu.querySelectorAll('.quality-option'),
          { x: 8, autoAlpha: 0 },
          { x: 0, autoAlpha: 1, duration: 0.2, ease: 'power2.out', stagger: 0.035, overwrite: 'auto' },
        );
      }

      if (openVolumePanel) {
        gsap.fromTo(
          openVolumePanel,
          { y: 10, scale: 0.98, autoAlpha: 0 },
          { y: 0, scale: 1, autoAlpha: 1, duration: 0.22, ease: 'power3.out', overwrite: 'auto' },
        );
      }

      const wingTween =
        root.classList.contains('playing') || root.querySelector('.video-frame.playing')
          ? gsap.to(progressWings, {
              rotation: (index) => (index === 0 ? -8 : 8),
              scaleY: 0.86,
              duration: 0.58,
              yoyo: true,
              repeat: -1,
              ease: 'sine.inOut',
              stagger: 0.05,
            })
          : undefined;

      const flutterProgress = () => {
        if (wingTween) {
          return;
        }

        gsap.fromTo(
          progressWings,
          { rotation: -6, scale: 0.96 },
          {
            rotation: 5,
            scale: 1.03,
            duration: 0.14,
            yoyo: true,
            repeat: 2,
            ease: 'sine.inOut',
            overwrite: 'auto',
          },
        );
      };

      const buttonCleanups = Array.from(controlButtons).map((button) => {
        const buttonMarks = button.querySelectorAll('.ritual-control-mark');
        const ring = button.querySelector('.ritual-ring');

        const showButtonMarks = () => {
          gsap.to(buttonMarks, {
            autoAlpha: 0.86,
            scaleY: 0.82,
            duration: 0.18,
            ease: 'power2.out',
            stagger: { each: 0.012, from: 'center' },
            overwrite: 'auto',
          });

          if (ring) {
            gsap.fromTo(
              ring,
              { rotation: -8, scale: 0.92 },
              { rotation: 0, scale: 1, duration: 0.26, ease: 'power3.out', overwrite: 'auto' },
            );
          }
        };

        const hideButtonMarks = () => {
          gsap.to(buttonMarks, {
            autoAlpha: 0,
            scaleY: 0.45,
            duration: 0.2,
            ease: 'power2.out',
            overwrite: 'auto',
          });
        };

        button.addEventListener('mouseenter', showButtonMarks);
        button.addEventListener('mouseleave', hideButtonMarks);
        button.addEventListener('focusin', showButtonMarks);
        button.addEventListener('focusout', hideButtonMarks);

        return () => {
          button.removeEventListener('mouseenter', showButtonMarks);
          button.removeEventListener('mouseleave', hideButtonMarks);
          button.removeEventListener('focusin', showButtonMarks);
          button.removeEventListener('focusout', hideButtonMarks);
        };
      });

      const qualityCleanups = Array.from(qualityControls).map((control) => {
        const current = control.querySelector('.quality-current');
        const sheen = control.querySelector('.quality-sheen');

        const liftQuality = () => {
          gsap.to(control, {
            y: -1,
            boxShadow: 'inset 0 0 14px oklch(55% 0.14 26 / 0.16), 0 8px 20px oklch(5% 0.01 24 / 0.22)',
            duration: 0.2,
            ease: 'power2.out',
            overwrite: 'auto',
          });

          if (current) {
            gsap.to(current, { scale: 1.04, duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
          }
        };

        const settleQuality = () => {
          gsap.to(control, {
            y: 0,
            scale: 1,
            duration: 0.2,
            ease: 'power2.out',
            clearProps: 'transform,boxShadow',
            overwrite: 'auto',
          });

          if (current) {
            gsap.to(current, { scale: 1, duration: 0.18, ease: 'power2.out', clearProps: 'transform', overwrite: 'auto' });
          }
        };

        const pulseQuality = () => {
          gsap.fromTo(
            control,
            { scale: 0.98 },
            { scale: 1.02, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut', overwrite: 'auto' },
          );

          if (sheen) {
            gsap.fromTo(
              sheen,
              { xPercent: -140, autoAlpha: 0 },
              { xPercent: 140, autoAlpha: 0.78, duration: 0.42, ease: 'power2.out', overwrite: 'auto' },
            );
          }
        };

        control.addEventListener('mouseenter', liftQuality);
        control.addEventListener('mouseleave', settleQuality);
        control.addEventListener('focusin', liftQuality);
        control.addEventListener('focusout', settleQuality);
        control.addEventListener('click', pulseQuality);

        return () => {
          control.removeEventListener('mouseenter', liftQuality);
          control.removeEventListener('mouseleave', settleQuality);
          control.removeEventListener('focusin', liftQuality);
          control.removeEventListener('focusout', settleQuality);
          control.removeEventListener('click', pulseQuality);
        };
      });

      const showMarks = () => {
        flutterProgress();
      };

      const hideMarks = () => {
        gsap.to(marks, {
          autoAlpha: 0,
          scaleY: 0.45,
          duration: 0.22,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      };

      controls?.addEventListener('mouseenter', showMarks);
      controls?.addEventListener('mouseleave', hideMarks);
      controls?.addEventListener('focusin', showMarks);
      controls?.addEventListener('focusout', hideMarks);

      return () => {
        wingTween?.kill();
        buttonCleanups.forEach((cleanup) => cleanup());
        qualityCleanups.forEach((cleanup) => cleanup());
        controls?.removeEventListener('mouseenter', showMarks);
        controls?.removeEventListener('mouseleave', hideMarks);
        controls?.removeEventListener('focusin', showMarks);
        controls?.removeEventListener('focusout', hideMarks);
      };
    }, root);

    return () => context.revert();
  }, dependencies);
}

export default useVideoRitualMotion;
