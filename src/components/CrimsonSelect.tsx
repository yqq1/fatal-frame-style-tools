import gsap from 'gsap';
import { ChevronDown } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';

type CrimsonSelectProps<T extends string> = {
  compact?: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
  value: T;
};

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function CrimsonSelect<T extends string>({
  compact = false,
  disabled = false,
  label,
  onChange,
  options,
  value,
}: CrimsonSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !isOpen || prefersReducedMotion()) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(menu, { y: -6, autoAlpha: 0, scale: 0.98 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.18, ease: 'power2.out', overwrite: 'auto' });
      gsap.fromTo(
        menu.querySelectorAll('.whisper-select-option'),
        { y: 5, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.16, ease: 'power2.out', stagger: 0.03, overwrite: 'auto' },
      );
    }, menu);

    return () => context.revert();
  }, [isOpen]);

  return (
    <span
      className={`whisper-select ${compact ? 'whisper-select-compact' : ''} ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setIsOpen(false);
        }
      }}
    >
      <button
        className="whisper-select-trigger"
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label={`${label}：${selectedOption?.label ?? ''}`}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{selectedOption?.label ?? value}</span>
        <ChevronDown className="whisper-select-chevron" size={14} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="whisper-select-menu" ref={menuRef} role="menu" aria-label={label}>
          <div className="whisper-select-options">
            {options.map((option) => {
              const isSelected = option.value === value;

              return (
                <button
                  className={`whisper-select-option ${isSelected ? 'selected' : ''}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </span>
  );
}
