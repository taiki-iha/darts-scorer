import { CRICKET_TARGETS, type CricketState } from '../../games/cricket';

const MARK = ['', '／', '×', '⊗'];

interface Props {
  state: CricketState;
  names: string[];
  current: number;
}

/** クリケットのマーク表（列=ターゲット、行=サイド）。スマホでボードの高さを確保するため横向き */
export function CricketBoard({ state, names, current }: Props) {
  const closedByAll = (t: number) => state.marks.every((m) => (m[t] ?? 0) >= 3);
  return (
    <table class="cricket">
      <thead>
        <tr>
          {/* table-layout: fixed は先頭行の幅を使うので、名前列・点数列のクラスをここにも付ける */}
          <th class="cr-name" />
          {CRICKET_TARGETS.map((t) => (
            <th key={t} class={closedByAll(t) ? 'dead' : ''}>
              {t === 25 ? 'B' : t}
            </th>
          ))}
          <th class="cr-score">PTS</th>
        </tr>
      </thead>
      <tbody>
        {names.map((n, i) => (
          <tr key={i} class={i === current ? 'cur' : ''}>
            <th class="cr-name">{n}</th>
            {CRICKET_TARGETS.map((t) => (
              <td key={t} class={closedByAll(t) ? 'dead' : ''}>
                {MARK[Math.min(3, state.marks[i][t] ?? 0)]}
              </td>
            ))}
            <td class="cr-score">{state.score[i]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
