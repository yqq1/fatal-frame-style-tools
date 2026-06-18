import type { CSSProperties, FocusEvent, PointerEvent, ButtonHTMLAttributes, ReactNode } from 'react';
import { useRef } from 'react';

type SpotlightStyle = CSSProperties & {
  '--spotlight-color': string;
  '--spotlight-opacity': number;
  '--spotlight-x': string;
  '--spotlight-y': string;
};

type SpotlightCardProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  spotlightColor?: string;
};

function setSpotlightPosition(element: HTMLButtonElement, x: string, y: string) {
  element.style.setProperty('--spotlight-x', x);
  element.style.setProperty('--spotlight-y', y);
}

function setSpotlightOpacity(element: HTMLButtonElement, value: number) {
  element.style.setProperty('--spotlight-opacity', String(value));
}

export function SpotlightCard({
  children,
  className = '',
  onBlur,
  onFocus,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  spotlightColor = 'oklch(62% 0.16 25 / 0.24)',
  style,
  type = 'button',
  ...props
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLButtonElement | null>(null);

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const card = cardRef.current;
    if (card && event.pointerType !== 'touch') {
      const rect = card.getBoundingClientRect();
      setSpotlightPosition(card, `${event.clientX - rect.left}px`, `${event.clientY - rect.top}px`);
    }

    onPointerMove?.(event);
  }

  function handlePointerEnter(event: PointerEvent<HTMLButtonElement>) {
    const card = cardRef.current;
    if (card && event.pointerType !== 'touch') {
      setSpotlightOpacity(card, 1);
    }

    onPointerEnter?.(event);
  }

  function handlePointerLeave(event: PointerEvent<HTMLButtonElement>) {
    const card = cardRef.current;
    if (card) {
      setSpotlightOpacity(card, 0);
    }

    onPointerLeave?.(event);
  }

  function handleFocus(event: FocusEvent<HTMLButtonElement>) {
    const card = cardRef.current;
    if (card) {
      setSpotlightPosition(card, '50%', '50%');
      setSpotlightOpacity(card, 1);
    }

    onFocus?.(event);
  }

  function handleBlur(event: FocusEvent<HTMLButtonElement>) {
    const card = cardRef.current;
    if (card) {
      setSpotlightOpacity(card, 0);
    }

    onBlur?.(event);
  }

  const spotlightStyle: SpotlightStyle = {
    '--spotlight-color': spotlightColor,
    '--spotlight-opacity': 0,
    '--spotlight-x': '50%',
    '--spotlight-y': '50%',
    ...style,
  };

  return (
    <button
      {...props}
      ref={cardRef}
      className={`spotlight-card ${className}`.trim()}
      style={spotlightStyle}
      type={type}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
    >
      <span className="spotlight-card-glow" aria-hidden="true" />
      {children}
    </button>
  );
}
