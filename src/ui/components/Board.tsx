import { useMemo, useRef, useState } from 'preact/hooks';
import { BOARD_ORDER, hitTest, R } from '../../core/board';
import { label } from '../../core/dart';
import type { Dart } from '../../core/types';

/** viewBox の半分の幅（数字リングまで入る） */
const VIEW = 1.3;
const LOUPE_ZOOM = 2.5;
const LOUPE_PX = 132; // ルーペの直径（画面ピクセル）
const LOUPE_GAP = 56; // 指先からルーペ下端までのすき間（画面ピクセル）。指の腹に隠れないよう広めに
const LOUPE_LABEL = 32; // ルーペ上のラベルの高さ
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
  /** 次に狙うエリア（上がり目）。点滅させる */
  target?: Dart | null;
  disabled?: boolean;
}

export function Board({ onDart, highlight = [], target, disabled }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  // x, y はボード座標、cx, cy は画面上の位置、unitPx はボード座標1あたりの画面ピクセル
  const [touch, setTouch] = useState<{ x: number; y: number; cx: number; cy: number; unitPx: number } | null>(null);
  const shapes = useMemo(() => <BoardShapes />, []);

  const toBoard = (e: PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 * VIEW - VIEW,
      y: ((e.clientY - rect.top) / rect.height) * 2 * VIEW - VIEW,
      cx: e.clientX,
      cy: e.clientY,
      unitPx: rect.width / (2 * VIEW),
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
  // ルーペはボードの外（画面に固定）に描き、どこを押しても常に指の真上に出す
  const loupe = touch && {
    left: touch.cx - LOUPE_PX / 2,
    top: Math.max(4, touch.cy - LOUPE_GAP - LOUPE_PX - LOUPE_LABEL),
    // ルーペに映すボード座標の幅
    span: LOUPE_PX / touch.unitPx / LOUPE_ZOOM,
  };

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
        {shapes}
        {target && areaPath(target) && <path d={areaPath(target)!} class="board-target" />}
        {highlight.map((d, i) => {
          const path = areaPath(d);
          return path ? <path key={i} d={path} class="board-hit" /> : null;
        })}
        {current && current.ring !== 'MISS' && <path d={areaPath(current)!} class="board-hover" />}
      </svg>
      {touch && loupe && (
        <div class="loupe" style={{ left: `${loupe.left}px`, top: `${loupe.top}px`, width: `${LOUPE_PX}px` }}>
          <div class="loupe-label">{current ? label(current) : ''}</div>
          <svg
            class="loupe-view"
            width={LOUPE_PX}
            height={LOUPE_PX}
            viewBox={`${touch.x - loupe.span / 2} ${touch.y - loupe.span / 2} ${loupe.span} ${loupe.span}`}
          >
            {shapes}
            {current && current.ring !== 'MISS' && <path d={areaPath(current)!} class="board-hover" />}
            <circle cx={touch.x} cy={touch.y} r={loupe.span * 0.025} fill="#fff" stroke="#000" stroke-width={loupe.span * 0.008} />
          </svg>
        </div>
      )}
    </div>
  );
}
