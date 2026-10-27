import { dart } from './dart';
import type { Dart } from './types';

/** ボード上部から時計回りの数字の並び */
export const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

/** ダブル外周 = 1 とした正規化半径 */
export const R = {
  DB: 0.0374,
  SB: 0.0935,
  TIN: 0.582,
  TOUT: 0.629,
  DIN: 0.953,
  DOUT: 1.0,
} as const;

/** 中心原点・上が -y の正規化座標から、刺さった場所を求める */
export function hitTest(x: number, y: number): Dart {
  const r = Math.hypot(x, y);
  if (r <= R.DB) return dart('DB');
  if (r <= R.SB) return dart('SB');
  if (r > R.DOUT) return dart('MISS');

  // 上を0°・時計回り。境界での浮動小数の揺れを丸める
  let deg = (Math.atan2(x, -y) * 180) / Math.PI;
  deg = Math.round(deg * 1e9) / 1e9;
  const idx = Math.floor((((deg + 9) % 360) + 360) % 360 / 18);
  const num = BOARD_ORDER[idx];

  if (r >= R.TIN && r <= R.TOUT) return dart('T', num);
  if (r >= R.DIN) return dart('D', num);
  return dart('S', num);
}
