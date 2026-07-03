function WaterDistortionVeil() {
  return (
    <svg
      className="water-distortion-veil"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 900"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="water-distortion-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.018" numOctaves="2" seed="12" result="noise">
            <animate
              attributeName="baseFrequency"
              dur="18s"
              values="0.008 0.018;0.012 0.014;0.008 0.018"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="24" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <radialGradient id="water-cold-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(76% 0.07 216 / 0.42)" />
          <stop offset="58%" stopColor="oklch(47% 0.09 214 / 0.16)" />
          <stop offset="100%" stopColor="oklch(35% 0.08 218 / 0)" />
        </radialGradient>
        <radialGradient id="water-crimson-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(64% 0.15 27 / 0.34)" />
          <stop offset="62%" stopColor="oklch(40% 0.12 26 / 0.12)" />
          <stop offset="100%" stopColor="oklch(26% 0.09 26 / 0)" />
        </radialGradient>
      </defs>
      <g className="water-distortion-forms" filter="url(#water-distortion-soft)">
        <ellipse className="water-form water-form-right" cx="1320" cy="360" rx="230" ry="380" fill="url(#water-cold-glow)" />
        <ellipse className="water-form water-form-bottom" cx="840" cy="860" rx="620" ry="170" fill="url(#water-cold-glow)" />
        <ellipse className="water-form water-form-left" cx="110" cy="540" rx="190" ry="320" fill="url(#water-crimson-glow)" />
        <ellipse className="water-form water-form-corner" cx="1230" cy="790" rx="260" ry="180" fill="url(#water-crimson-glow)" />
      </g>
    </svg>
  );
}

export default WaterDistortionVeil;
