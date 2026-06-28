interface SparklineProps {
  data: number[];
  color: string;
  className?: string;
}

/**
 * Tiny inline trend line. Draws a real polyline when the series varies;
 * falls back to a faint flat baseline when there's no variation (e.g. an
 * empty database produces all-zeros) — never an invented trend.
 */
export default function Sparkline({ data, color, className }: SparklineProps) {
  const w = 84;
  const h = 26;
  const pad = 3;

  const valid = data.length >= 2;
  const max = valid ? Math.max(...data) : 0;
  const min = valid ? Math.min(...data) : 0;
  const flat = !valid || max === min;

  if (flat) {
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
        <line
          x1={pad}
          y1={h / 2}
          x2={w - pad}
          y2={h / 2}
          stroke={color}
          strokeOpacity="0.22"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const span = max - min;
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - 2 * pad)) / (data.length - 1);
    const y = h - pad - ((v - min) / span) * (h - 2 * pad);
    return [x, y] as const;
  });
  const last = pts[pts.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden="true">
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="1.9" fill={color} />
    </svg>
  );
}
