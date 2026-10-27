import { CRICKET_TARGETS, type CricketState } from '../../games/cricket';

const MARK = ['', '／', '×', '⊗'];

interface Props {
  state: CricketState;
  names: string[];
  current: number;
}

/** クリケットのマーク表（行=ターゲット、列=サイド） */
export function CricketBoard({ state, names, current }: Props) {
  const closedByAll = (t: number) => state.marks.every((m) => (m[t] ?? 0) >= 3);
  return (
    <table class="cricket">
      <thead>
        <tr>
          <th />
          {names.map((n, i) => (
            <th key={i} class={i === current ? 'cur' : ''}>
              <div class="cr-name">{n}</div>
              <div class="cr-score">{state.score[i]}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {CRICKET_TARGETS.map((t) => (
          <tr key={t} class={closedByAll(t) ? 'dead' : ''}>
            <th>{t === 25 ? 'BULL' : t}</th>
            {state.marks.map((m, i) => (
              <td key={i} class={i === current ? 'cur' : ''}>
                {MARK[Math.min(3, m[t] ?? 0)]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
