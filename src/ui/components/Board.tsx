import { useMemo, useRef, useState } from 'preact/hooks';
import { BOARD_ORDER, hitTest, R } from '../../core/board';
import { label } from '../../core/dart';
import type { Dart } from '../../core/types';

/** viewBox の半分の幅（数字リングまで入る） */
const VIEW = 1.3;
const LOUPE_ZOOM = 2.5;
const LOUPE_R = 0.32; // 画面上のルーペ半径（ボード座標）
const STEP = (Math.PI * 2) / 20;

function arc(r1: number, r2: number, a1: number, a2: number) {
  const p = (r: number, a: number) => [r * Math.sin(a), -r * Math.cos(a)];
  const [x1, y1] = p(r2, a1);
  const [x2, y2] = p(r2, a2);
  const [x3, y3] = p(r1, a2);
  const [x4, y4] = p(r1, a1);
  return `M${x1},${y1}A${r2},${r2} 0 0 1 ${x2},${y2}L${x3},${y3}A${r1},${r1} 0 0 0 ${x4},${y4}Z`;
}

/** ダーツが刺さったエリアの形（ハイライト用） */
function areaPath(d: Dart): string | null {
  if (d.ring === 'MISS') return null;
  if (d.ring === 'DB') return `M0,${-R.DB}A${R.DB},${R.DB} 0 1 1 0,${R.DB}A${R.DB},${R.DB} 0 1 1 0,${-R.DB}Z`;
  if (d.ring === 'SB') return arc(R.DB, R.SB, 0, Math.PI * 2 - 1e-4);
  const i = BOARD_ORDER.indexOf(d.num);
  const a1 = (i - 0.5) * STEP;
  const a2 = (i + 0.5) * STEP;
  if (d.ring === 'T') return arc(R.TIN, R.TOUT, a1, a2);
  if (d.ring === 'D') return arc(R.DIN, R.DOUT, a1, a2);
  return `${arc(R.SB, R.TIN, a1, a2)} ${arc(R.TOUT, R.DIN, a1, a2)}`;
}

function BoardShapes() {
  return (
    <g>
      <circle r={VIEW} fill="#07031a" />
      <circle r={1.02} fill="#000" stroke="var(--cyan)" stroke-width="0.01" style={{ filter: 'drop-shadow(0 0 0.03px var(--cyan))' }} />
      {BOARD_ORDER.map((n, i) => {
        const a1 = (i - 0.5) * STEP;
        const a2 = (i + 0.5) * STEP;
        const dark = i % 2 === 0;
        const base = dark ? '#0d0730' : '#1e1550';
        const ring = dark ? '#ff2bd6' : '#00e5ff';
        const a = i * STEP;
        return (
          <g key={n}>
            <path d={arc(R.SB, R.TIN, a1, a2)} fill={base} stroke="#3a2a7a" stroke-width="0.004" />
            <path d={arc(R.TIN, R.TOUT, a1, a2)} fill={ring} opacity="0.85" />
            <path d={arc(R.TOUT, R.DIN, a1, a2)} fill={base} stroke="#3a2a7a" stroke-width="0.004" />
            <path d={arc(R.DIN, R.DOUT, a1, a2)} fill={ring} opacity="0.85" />
            <text
              x={1.15 * Math.sin(a)}
              y={-1.15 * Math.cos(a) + 0.045}
              fill="#e8f6ff"
              font-size="0.13"
              font-weight="700"
              text-anchor="middle"
            >
              {n}
            </text>
          </g>
        );
      })}
      <circle r={R.SB} fill="#00e5ff" opacity="0.85" />
      <circle r={R.DB} fill="#ff2bd6" />
    </g>
  );
}

interface Props {
  onDart: (d: Dart) => void;
  highlight?: Dart[];
  disabled?: boolean;
}

export function Board({ onDart, highlight = [], disabled }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [touch, setTouch] = useState<{ x: number; y: number } | null>(null);
  const shapes = useMemo(() => <BoardShapes />, []);

  const toBoard = (e: PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 * VIEW - VIEW,
      y: ((e.clientY - rect.top) / rect.height) * 2 * VIEW - VIEW,
    };
  };

  const down = (e: PointerEvent) => {
    if (disabled) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setTouch(toBoard(e));
  };
  const move = (e: PointerEvent) => {
    if (touch) setTouch(toBoard(e));
  };
  const up = (e: PointerEvent) => {
    if (!touch) return;
    const p = toBoard(e);
    setTouch(null);
    onDart(hitTest(p.x, p.y));
  };
  const cancel = () => setTouch(null);

  const current = touch ? hitTest(touch.x, touch.y) : null;
  // ルーペは指の上側に出す。上端からはみ出す場合は下側
  const loupeY = touch ? (touch.y - 0.55 < -VIEW + LOUPE_R ? touch.y + 0.55 : touch.y - 0.55) : 0;
  const zoomR = LOUPE_R / LOUPE_ZOOM;

  return (
    <div class="board-wrap">
      <svg
        ref={ref}
        class="board"
        viewBox={`${-VIEW} ${-VIEW} ${VIEW * 2} ${VIEW * 2}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={cancel}
      >
        <defs>
          <clipPath id="loupe-clip">
            <circle r={LOUPE_R} />
          </clipPath>
        </defs>
        {shapes}
        {highlight.map((d, i) => {
          const path = areaPath(d);
          return path ? <path key={i} d={path} class="board-hit" /> : null;
        })}
        {current && current.ring !== 'MISS' && <path d={areaPath(current)!} class="board-hover" />}
        {touch && (
          <g transform={`translate(${touch.x} ${loupeY})`} pointer-events="none">
            <circle r={LOUPE_R + 0.015} fill="#000" stroke="var(--magenta)" stroke-width="0.015" />
            <g clip-path="url(#loupe-clip)">
              <g transform={`scale(${LOUPE_ZOOM}) translate(${-touch.x} ${-touch.y})`}>
                {shapes}
                {current && current.ring !== 'MISS' && <path d={areaPath(current)!} class="board-hover" />}
                <circle cx={touch.x} cy={touch.y} r={zoomR * 0.08} fill="#fff" />
              </g>
            </g>
            <text y={LOUPE_R + 0.13} class="loupe-label" text-anchor="middle">
              {current ? label(current) : ''}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
