interface LogoProps {
  /** Square size in px */
  size?: number;
  /** Render the navy rounded-square container behind the pulse line */
  withSquare?: boolean;
  className?: string;
}

/**
 * Finia logo — an ECG / pulse line with a pulse-blue dot at the highest peak,
 * optionally set inside a navy rounded square.
 */
export default function Logo({ size = 36, withSquare = true, className = "" }: LogoProps) {
  const radius = Math.round(size * 0.28);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        background: withSquare ? "#1b3a6b" : "transparent",
        borderRadius: withSquare ? radius : 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        viewBox="0 0 32 32"
        width={size * 0.7}
        height={size * 0.7}
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M2 18 H9 L12 18 L16 7 L20 25 L23 18 H30"
          stroke="#ffffff"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* white dot at the highest peak, rendered in pulse blue so it reads
            against the white line (brand accent, used sparingly) */}
        <circle cx="16" cy="7" r="2.5" fill="#2ba8e0" />
      </svg>
    </div>
  );
}
