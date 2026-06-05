import gsap from 'gsap';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

type DragSample = {
  time: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startScrollTop: number;
  startY: number;
  samples: DragSample[];
  moved: boolean;
  started: boolean;
};

type LyricDragScrollOptions = {
  activeIndex: number;
  activeLineRef: RefObject<HTMLButtonElement | null>;
  currentTime: number;
  scrollRef: RefObject<HTMLDivElement | null>;
};

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getMaxScrollTop(element: HTMLElement) {
  return Math.max(0, element.scrollHeight - element.clientHeight);
}

function getTargetScrollTop(container: HTMLElement, activeLine: HTMLElement) {
  return clamp(
    activeLine.offsetTop - container.clientHeight * 0.34 + activeLine.offsetHeight * 0.5,
    0,
    getMaxScrollTop(container),
  );
}

function isActiveLineVisible(container: HTMLElement, activeLine: HTMLElement) {
  const containerRect = container.getBoundingClientRect();
  const lineRect = activeLine.getBoundingClientRect();

  return lineRect.top >= containerRect.top && lineRect.bottom <= containerRect.bottom;
}

function useLyricDragScroll({ activeIndex, activeLineRef, currentTime, scrollRef }: LyricDragScrollOptions) {
  const [isDragging, setIsDragging] = useState(false);
  const [isAutoFollowPaused, setIsAutoFollowPaused] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const previousActiveIndexRef = useRef(activeIndex);
  const scrollTweenRef = useRef<gsap.core.Tween | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const originalUserSelectRef = useRef('');

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const killScrollTween = useCallback(() => {
    scrollTweenRef.current?.kill();
    scrollTweenRef.current = null;
  }, []);

  const scrollToActiveLine = useCallback(
    (duration = 0.42) => {
      const container = scrollRef.current;
      const activeLine = activeLineRef.current;
      if (!container || !activeLine) {
        return;
      }

      const target = getTargetScrollTop(container, activeLine);
      killScrollTween();

      if (prefersReducedMotion() || duration === 0) {
        container.scrollTop = target;
        gsap.set(container, { y: 0 });
        return;
      }

      scrollTweenRef.current = gsap.to(container, {
        scrollTop: target,
        y: 0,
        duration,
        ease: 'power3.out',
        overwrite: 'auto',
        onComplete: () => {
          scrollTweenRef.current = null;
        },
      });
    },
    [activeLineRef, killScrollTween, scrollRef],
  );

  const resumeAutoFollow = useCallback(() => {
    clearIdleTimer();
    setIsAutoFollowPaused(false);
    scrollToActiveLine(0.36);
  }, [clearIdleTimer, scrollToActiveLine]);

  const schedulePassiveRestore = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      const container = scrollRef.current;
      const activeLine = activeLineRef.current;
      if (!container || !activeLine) {
        return;
      }

      if (isActiveLineVisible(container, activeLine)) {
        setIsAutoFollowPaused(false);
      }
    }, 6000);
  }, [activeLineRef, clearIdleTimer, scrollRef]);

  useLayoutEffect(() => {
    if (isDragging || activeIndex < 0) {
      return;
    }

    if (isAutoFollowPaused && previousActiveIndexRef.current !== activeIndex) {
      clearIdleTimer();
      setIsAutoFollowPaused(false);
      scrollToActiveLine(0.36);
      previousActiveIndexRef.current = activeIndex;
      return;
    }

    if (isAutoFollowPaused) {
      previousActiveIndexRef.current = activeIndex;
      return;
    }

    scrollToActiveLine();
    previousActiveIndexRef.current = activeIndex;
  }, [activeIndex, clearIdleTimer, isAutoFollowPaused, isDragging, scrollToActiveLine]);

  useEffect(() => {
    if (!isAutoFollowPaused || isDragging) {
      return;
    }

    schedulePassiveRestore();
  }, [currentTime, isAutoFollowPaused, isDragging, schedulePassiveRestore]);

  useEffect(() => {
    return () => {
      clearIdleTimer();
      killScrollTween();
      document.body.style.userSelect = originalUserSelectRef.current;
    };
  }, [clearIdleTimer, killScrollTween]);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) {
        return;
      }

      const container = scrollRef.current;
      if (!container) {
        return;
      }

      clearIdleTimer();
      killScrollTween();

      dragStateRef.current = {
        moved: false,
        pointerId: event.pointerId,
        samples: [{ time: performance.now(), y: event.clientY }],
        startScrollTop: container.scrollTop,
        startY: event.clientY,
        started: false,
      };
    },
    [clearIdleTimer, killScrollTween, scrollRef],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = scrollRef.current;
      const dragState = dragStateRef.current;
      if (!container || !dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      const deltaY = event.clientY - dragState.startY;
      if (!dragState.started && Math.abs(deltaY) <= 6) {
        return;
      }

      if (!dragState.started) {
        dragState.started = true;
        container.setPointerCapture(event.pointerId);
        setIsDragging(true);
        setIsAutoFollowPaused(true);
        originalUserSelectRef.current = document.body.style.userSelect;
        document.body.style.userSelect = 'none';
      }

      event.preventDefault();

      const maxScrollTop = getMaxScrollTop(container);
      let nextScrollTop = dragState.startScrollTop - deltaY;
      let overscrollY = 0;

      if (nextScrollTop < 0) {
        overscrollY = -nextScrollTop * 0.18;
        nextScrollTop *= 0.28;
      } else if (nextScrollTop > maxScrollTop) {
        overscrollY = -(nextScrollTop - maxScrollTop) * 0.18;
        nextScrollTop = maxScrollTop + (nextScrollTop - maxScrollTop) * 0.28;
      }

      container.scrollTop = clamp(nextScrollTop, 0, maxScrollTop);
      gsap.set(container, { y: overscrollY });

      if (Math.abs(deltaY) > 4) {
        dragState.moved = true;
      }

      dragState.samples.push({ time: performance.now(), y: event.clientY });
      dragState.samples = dragState.samples.slice(-6);
    },
    [scrollRef],
  );

  const finishDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const container = scrollRef.current;
      const dragState = dragStateRef.current;
      if (!container || !dragState || dragState.pointerId !== event.pointerId) {
        return;
      }

      if (!dragState.started) {
        dragStateRef.current = null;
        return;
      }

      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId);
      }

      document.body.style.userSelect = originalUserSelectRef.current;
      setIsDragging(false);
      dragStateRef.current = null;

      if (dragState.moved) {
        event.preventDefault();
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 180);
      }

      const samples = dragState.samples;
      const first = samples[0];
      const last = samples[samples.length - 1];
      const elapsed = last && first ? Math.max(1, last.time - first.time) : 1;
      const velocity = last && first ? (last.y - first.y) / elapsed : 0;
      const maxScrollTop = getMaxScrollTop(container);
      const reducedMotion = prefersReducedMotion();

      killScrollTween();

      if (reducedMotion || Math.abs(velocity) < 0.08) {
        gsap.to(container, { y: 0, duration: reducedMotion ? 0 : 0.22, ease: 'power2.out', overwrite: 'auto' });
        schedulePassiveRestore();
        return;
      }

      const rawTarget = container.scrollTop - velocity * 450;
      const target = clamp(rawTarget, 0, maxScrollTop);

      scrollTweenRef.current = gsap.to(container, {
        scrollTop: target,
        y: 0,
        duration: 0.58,
        ease: 'power3.out',
        overwrite: 'auto',
        onComplete: () => {
          scrollTweenRef.current = null;
        },
      });

      schedulePassiveRestore();
    },
    [killScrollTween, schedulePassiveRestore, scrollRef],
  );

  const handleWheel = useCallback(() => {
    killScrollTween();
    setIsAutoFollowPaused(true);
    schedulePassiveRestore();
  }, [killScrollTween, schedulePassiveRestore]);

  const shouldSuppressClick = useCallback(() => suppressClickRef.current, []);

  return {
    isAutoFollowPaused,
    isDragging,
    lyricDragHandlers: {
      onPointerCancel: finishDrag,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishDrag,
      onWheel: handleWheel,
    },
    resumeAutoFollow,
    shouldSuppressClick,
  };
}

export default useLyricDragScroll;
