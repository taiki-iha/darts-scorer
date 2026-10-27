interface Props {
  points: { x: number; y: number }[];
  yLabel: string;
  /** 平均線（マゼンタの破線） */
  avg?: number;
}

const W = 320;
const H = 180;
const PAD = { l: 40, r: 10, t: 14, b: 22 };

/** 推移グラフ（x は試合の順番、y は値） */
export function LineChart({ points, yLabel, avg }: Props) {
  if (points.length === 0) return null;
  const ys = points.map((p) => p.y).concat(avg ?? []);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  lo -= span * 0.1;
  hi += span * 0.1;
  const n = points.length;
  const sx = (i: number) => PAD.l + (n === 1 ? (W - PAD.l - PAD.r) / 2 : (i / (n - 1)) * (W - PAD.l - PAD.r));
  const sy = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const fmt = (v: number) => (Math.abs(hi) >= 100 ? Math.round(v) : v.toFixed(1));
  const ticks = [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1];
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i)},${sy(p.y)}`).join('');

  return (
    <svg class="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} の推移`}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} class="chart-grid" />
          <text x={PAD.l - 4} y={sy(t) + 3} class="chart-tick" text-anchor="end">
            {fmt(t)}
          </text>
        </g>
      ))}
      <text x={PAD.l} y={H - 6} class="chart-tick">
        古い
      </text>
      <text x={W - PAD.r} y={H - 6} class="chart-tick" text-anchor="end">
        新しい
      </text>
      {avg !== undefined && <line x1={PAD.l} x2={W - PAD.r} y1={sy(avg)} y2={sy(avg)} class="chart-avg" />}
      <path d={line} class="chart-line" />
      {points.map((p, i) => (
        <circle key={i} cx={sx(i)} cy={sy(p.y)} r={n > 40 ? 1.5 : 3} class="chart-dot" />
      ))}
    </svg>
  );
}
