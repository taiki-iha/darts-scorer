# ダーツ記録アプリ 第1弾 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 01系・スタンダードクリケット・カウントアップを、個人戦/チーム戦/レグ制、全アワード演出、登録プレイヤー＋ゲスト、成績画面、ゲーム再開、PWA付きで遊べる静的Webアプリを作り、GitHub Pages に公開する。

**Architecture:** ゲームのルールは純粋関数のモジュール（`games/`）に閉じ、試合進行は「設定＋イベント列（dart / next）」を毎回リプレイして状態を作る純粋な reducer（`match/engine.ts`）にする。取り消し＝イベントを1つ消す、再開＝保存したイベント列をリプレイ、成績＝保存済み試合をリプレイして投擲ログから集計、とすべて同じ仕組みで済ませる。UI は Preact、保存は IndexedDB。

**Tech Stack:** Vite 6 + TypeScript 5 + Preact 10、Vitest（+ fake-indexeddb）、`idb`（IndexedDB ラッパー）、`vite-plugin-pwa`、GitHub Actions → GitHub Pages。グラフは自前SVG（ライブラリなし）。

**Spec:** `docs/superpowers/specs/2026-10-27-darts-scorer-design.md`

## Global Constraints

- リポジトリのルートは `雑用\ダーツ` フォルダ（spec §3）。`.superpowers/`, `node_modules/`, `dist/` は `.gitignore`。
- 公開先: GitHub アカウント `taiki-iha` の公開リポジトリ `darts-scorer`、URL `https://taiki-iha.github.io/darts-scorer/`。ビルド時の `base` は `/darts-scorer/`、開発時は `/`。
- 対応: Chrome / Safari 最新版（PC・iPhone・iPad・Android）。縦スマホ（幅375px）を主にレスポンシブ。
- 実行時に CDN へ依存しない（すべてバンドル）。オフライン動作（PWA）。
- データは端末内のみ（IndexedDB）。サーバー通信なし。
- 見た目: ネオン・サイバー。背景 `#05010f`〜`#1a0b3d`、シアン `#00e5ff`、マゼンタ `#ff2bd6`。
- 効果音は Web Audio API で合成。外部音源ファイルは使わない。
- 演出はタップ / `Esc` / 次の入力で即スキップ可能。
- UI の文言は日本語。アワード名は英語表記（`TON 80!` など）。
- ブル既定値: ファット。カウントアップは常にファット。
- ゲストの成績は保存しない。チーム戦で投げた分は個人成績に含める。
- 途中で中断した（完了していない）試合は履歴・成績に入れない（計画上の判断）。

## Review Focus

1. **取り消し（戻す）がターン・レグの境目やバースト・上がりの直後でも正しく戻ること** → Task 7 にテスト `undo across turn, bust and leg boundaries` を追加。
2. **リロード・タブを閉じた後に、進行中の試合が1投も欠けずに再開できること** → Task 9 にテスト `current match round-trips events` を追加。Task 7 の `replay is deterministic` も同じ目的。
3. **ボードのリング境界付近のタップと、指をボード外へずらした場合**（境界値で誤判定しない／ボード外は MISS）→ Task 2 にテスト `ring boundaries` を追加。
4. **人数の違うチーム（2人対3人）でメンバーの順番が正しく回ること** → Task 7 にテスト `unequal teams rotate members independently` を追加。
5. **iPhone Safari で最初の操作まで音が鳴らない／幅375pxで画面が崩れる** → Task 11 の手動確認ステップ（モバイル幅プレビューと、ゲーム開始ボタンでの音声アンロック）。

---

## File Structure

```
ダーツ/
  index.html
  package.json, tsconfig.json, vite.config.ts, .gitignore
  public/icons/icon-192.png, icon-512.png
  .github/workflows/deploy.yml
  src/
    main.tsx                 エントリ。<App/> を描画
    styles/neon.css          色トークン・共通スタイル・演出アニメ
    core/types.ts            Dart, Ring など共通型
    core/dart.ts             点数・マーク・表示ラベル
    core/board.ts            座標→Dart の判定、ボード形状定数
    input/keyboard.ts        キー入力の状態機械（純粋）
    games/types.ts           GameRule インターフェース・オプション型
    games/x01.ts             01系ルール＋上がり目
    games/cricket.ts         スタンダードクリケット
    games/countup.ts         カウントアップ
    games/registry.ts        gameId → GameRule
    match/types.ts           MatchConfig, MatchEvent, MatchState, ThrowRecord
    match/engine.ts          replay / 1イベント適用 / 取り消し
    awards/awards.ts         アワード判定
    storage/db.ts            IndexedDB（players / matches / kv）、エクスポート・インポート
    stats/stats.ts           試合→成績集計
    audio/sfx.ts             効果音合成
    ui/App.tsx               画面切替（ルーターなし、state で切替）
    ui/screens/*.tsx         Home, Players, GameSelect, MatchSetup, Play, Result, Stats, Settings
    ui/components/Board.tsx        ボード描画＋ルーペ入力
    ui/components/X01Board.tsx     01 スコア表示
    ui/components/CricketBoard.tsx クリケットのマーク表
    ui/components/AwardOverlay.tsx 演出
    ui/components/LineChart.tsx    推移グラフ（SVG）
  tests/  （src と同じ階層で *.test.ts）
```

---

### Task 1: プロジェクト雛形

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/main.tsx`, `src/ui/App.tsx`, `src/styles/neon.css`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev` / `npm run build` / `npm test`（`vitest run`）。`App` コンポーネント（`export function App(): JSX.Element`）。

- [ ] **Step 1:** `雑用\ダーツ` で `git init`。`.gitignore` に `node_modules/`, `dist/`, `.superpowers/` を書く。
- [ ] **Step 2:** `npm create vite@latest` 相当の構成を手で作る（テンプレート preact-ts）。依存: `preact`, `idb`。開発依存: `vite`, `@preact/preset-vite`, `typescript`, `vitest`, `fake-indexeddb`, `vite-plugin-pwa`。`vite.config.ts` の `base` は `command === 'build' ? '/darts-scorer/' : '/'`。Vitest の environment は `node`（UI テストは書かない）。
- [ ] **Step 3:** `tests/smoke.test.ts` に `expect(1 + 1).toBe(2)` を書き、`npm test` → PASS。
- [ ] **Step 4:** `neon.css` に Global Constraints の色を CSS 変数（`--bg`, `--bg2`, `--cyan`, `--magenta`, `--text`）で定義し、`App` はタイトル「DARTS」をネオングローで表示するだけ。`npm run dev` を Browser pane で開き、表示を確認。
- [ ] **Step 5: Commit** `chore: scaffold vite + preact + vitest`

### Task 2: ダーツの型・点数・ボード判定

**Files:**
- Create: `src/core/types.ts`, `src/core/dart.ts`, `src/core/board.ts`
- Test: `src/core/dart.test.ts`, `src/core/board.test.ts`

**Interfaces:**
- Produces:
```ts
// types.ts
export type Ring = 'S' | 'D' | 'T' | 'SB' | 'DB' | 'MISS';
export interface Dart { ring: Ring; num: number } // num: 1-20、SB/DB は 25、MISS は 0
export type BullMode = 'fat' | 'separate';
// dart.ts
export function points(d: Dart, bull: BullMode): number;   // S=n, D=2n, T=3n, SB=25|50, DB=50, MISS=0
export function multiplier(d: Dart): 0 | 1 | 2 | 3;        // SB=1, DB=2
export function label(d: Dart): string;                     // 'T20','D16','5','BULL','D-BULL','MISS'
export const dart: (ring: Ring, num?: number) => Dart;      // テスト用ショートハンド
// board.ts
export const BOARD_ORDER: number[]; // [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5]
export const R: { DB: number; SB: number; TIN: number; TOUT: number; DIN: number; DOUT: number };
//   ボード半径(ダブル外周)=1 とした正規化値: DB 0.0374, SB 0.0935, TIN 0.582, TOUT 0.629, DIN 0.953, DOUT 1.0
export function hitTest(x: number, y: number): Dart;        // 中心原点、上が -y、正規化座標
```

- [ ] **Step 1: 失敗するテストを書く**
  - `points`: `T20`→60、`D16`→32、`SB` fat→50 / separate→25、`DB`→50、`MISS`→0
  - `label`: `dart('T',20)`→`'T20'`、`dart('S',5)`→`'5'`、`dart('SB')`→`'BULL'`、`dart('DB')`→`'D-BULL'`
  - `hitTest`: `(0,0)`→DB、`(0,-0.6)`→T20、`(0.6,0)`→T6、`(0,0.6)`→T3、`(0,-0.97)`→D20、`(0,-1.01)`→MISS
  - `ring boundaries`: `r = R.TIN - 1e-6`→S、`r = R.TIN`→T、`r = R.TOUT`→S、`r = R.DOUT`→D、`r = R.DOUT + 1e-6`→MISS（判定は「内側半径以上・外側半径以下」）。セグメント境界は 20 と 1 の境目 `angle = 9°` で `1` 側。
- [ ] **Step 2:** `npx vitest run src/core` → FAIL
- [ ] **Step 3:** 実装。角度は上を0°・時計回り、`idx = floor(((deg + 9) mod 360) / 18)`、`BOARD_ORDER[idx]`。
- [ ] **Step 4:** `npx vitest run src/core` → PASS
- [ ] **Step 5: Commit** `feat: dart scoring and board hit test`

### Task 3: キーボード入力の状態機械

**Files:**
- Create: `src/input/keyboard.ts`
- Test: `src/input/keyboard.test.ts`

**Interfaces:**
- Consumes: `Dart`, `dart()`（Task 2）
- Produces:
```ts
export interface KeyState { mod: 'S' | 'D' | 'T'; pendingDigit: number | null; pendingAt: number }
export const initialKeyState: KeyState;
export type KeyAction = { kind: 'dart'; dart: Dart } | { kind: 'undo' } | { kind: 'next' } | { kind: 'escape' };
export function onKey(s: KeyState, key: string, shift: boolean, now: number): { state: KeyState; actions: KeyAction[] };
export function flush(s: KeyState, now: number): { state: KeyState; actions: KeyAction[] }; // 保留中の数字を確定（UIが600ms後に呼ぶ）
export const DIGIT_WAIT_MS = 600;
```

- [ ] **Step 1: 失敗するテストを書く**（キー名は `KeyboardEvent.key` の値）
  - `' '`→MISS、`'b'`→SB、`'b'`+shift→DB、`'d'`,`'b'`→DB
  - `'t'`,`'2'`,`'0'`→T20、`'d'`,`'1'`,`'6'`→D16、`'5'`→S5（3〜9は即確定）
  - `'1'` の後 `flush(now+600)`→S1、`'2'` の後 `'5'`→S2 と S5 の2投（20以外の2x は成立しない）
  - `'1'` の後 700ms 経ってから `'5'`→S1 と S5（期限切れなら先に確定）
  - 修飾は1投で S に戻る。`'Escape'` は修飾と保留を消し `escape` を返す。`'Enter'`→保留を確定してから `next`、`'Backspace'`→保留があれば消すだけ、なければ `undo`
- [ ] **Step 2:** `npx vitest run src/input` → FAIL
- [ ] **Step 3:** 実装。
- [ ] **Step 4:** `npx vitest run src/input` → PASS
- [ ] **Step 5: Commit** `feat: keyboard dart entry`

### Task 4: GameRule インターフェースと 01 系

**Files:**
- Create: `src/games/types.ts`, `src/games/x01.ts`
- Test: `src/games/x01.test.ts`

**Interfaces:**
- Consumes: `Dart`, `points`, `multiplier`, `BullMode`（Task 2）
- Produces:
```ts
// games/types.ts
export type GameId = 'x01' | 'cricket' | 'countup';
export type InOut = 'open' | 'double' | 'master';
export interface X01Options { start: 301 | 501 | 701 | 901 | 1101 | 1501; in: InOut; out: InOut; bull: BullMode; maxRounds: number }
export interface CricketOptions { maxRounds: number }          // 既定 20
export interface CountUpOptions { rounds: number }             // 8 固定
export type GameOptions = X01Options | CricketOptions | CountUpOptions;
export interface ThrowResult<S> { state: S; bust?: boolean; finished?: boolean }
export interface GameRule<S, O> {
  id: GameId;
  defaults(): O;
  maxRounds(o: O): number;
  init(o: O, sides: number): S;
  startTurn(s: S, side: number): S;                          // ターン開始時のスナップショット保存など
  throwDart(s: S, o: O, side: number, d: Dart): ThrowResult<S>;
  limitWinners(s: S): number[];                               // ラウンド上限到達時の勝者（同点なら複数）
}
// x01.ts
export interface X01State { remaining: number[]; opened: boolean[]; turnStart: number[]; turnStartOpened: boolean[] }
export const x01: GameRule<X01State, X01Options>;
export function checkoutHint(remaining: number, out: InOut, bull: BullMode): string[] | null; // 3投以内の上がり例。無ければ null
```

- [ ] **Step 1: 失敗するテストを書く**
  - 既定: `defaults()` は `{start:501,in:'open',out:'open',bull:'fat',maxRounds:15}`。`maxRounds` 既定は 301→10、501→15、701以上→20（start 変更時の既定値は UI 側で `defaultRoundsFor(start)` を使う。これも export してテスト）
  - open in/out: 501 から T20,T20,T20 → 321
  - バースト: 残り 40 で T20 → `bust:true`、remaining は 40 に戻る
  - double out: 残り 32 で D16 → `finished:true`。残り 32 で S16,S16 → 2投目で bust（0 でもダブルでない）。残り 1 → 何を投げても 1 以下は bust
  - master out: T20 で残り 60→0 は finished
  - double in: 未オープンで S20 → 変化なし、D20 → オープンして 40 減る。そのターン中に bust したら `opened` もターン開始時に戻る
  - fat/separate: separate で SB は 25 減る
  - `limitWinners`: 残り [40, 12, 12] → `[1,2]`
  - `checkoutHint(170,'double','fat')` → `['T20','T20','D-BULL']`、`checkoutHint(169,'double','fat')` → `null`、`checkoutHint(40,'double','fat')` → `['D20']`、`checkoutHint(50,'open','fat')` → `['BULL']`。残り 171 以上は `null`
- [ ] **Step 2:** `npx vitest run src/games/x01` → FAIL
- [ ] **Step 3:** 実装。`checkoutHint` は投数の少ない順に全探索し、同じ投数ならシングル 20 系・高いトリプルを優先（「最後の1本がダブル系」という制約を out に応じて掛ける）。fat 時は SB も 50 だが double out では SB は不可、DB のみ可。
- [ ] **Step 4:** PASS
- [ ] **Step 5: Commit** `feat: x01 rules and checkout hints`

### Task 5: スタンダードクリケット

**Files:**
- Create: `src/games/cricket.ts`
- Test: `src/games/cricket.test.ts`

**Interfaces:**
- Consumes: `GameRule`, `CricketOptions`（Task 4）、`Dart`, `multiplier`
- Produces:
```ts
export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25] as const;
export interface CricketState { marks: Record<number, number>[]; score: number[]; turnMarks: number; closedAtTurnStart: number[][] } // JSON 化・deepEqual のため Set は使わない
export const cricket: GameRule<CricketState, CricketOptions>;
export function marksOf(d: Dart): number;   // 対象外は0。SB=1, DB=2
```

- [ ] **Step 1: 失敗するテストを書く**
  - T20 → 20 のマーク 3（オープン）。もう一度 T20（相手未オープン）→ +60 点
  - 相手もオープン済みの数字は加点しない
  - S14 は 0 マーク・0 点
  - DB → ブル 2 マーク。ブル超過分は 1 マーク 25 点
  - 勝利: 全 7 ターゲットを閉じ、かつ点数がほかの全サイド以上 → `finished:true`。閉じきっても点数で負けていれば継続
  - `turnMarks` はそのターンの有効マーク数の合計（4マーク目以降の超過分も含めて数える）。`startTurn` で 0 に戻る
  - `limitWinners`: 点数の多い方、同点ならマーク合計の多い方、さらに同点なら複数返す
  - 既定 `maxRounds` = 20
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: Commit** `feat: standard cricket`

### Task 6: カウントアップとレジストリ

**Files:**
- Create: `src/games/countup.ts`, `src/games/registry.ts`
- Test: `src/games/countup.test.ts`

**Interfaces:**
- Produces:
```ts
export interface CountUpState { total: number[] }
export const countup: GameRule<CountUpState, CountUpOptions>;  // 8ラウンド、ブルは常に fat
export const GAMES: Record<GameId, { rule: GameRule<any, any>; name: string; family: 'x01' | 'cricket' | 'countup' }>;
// name: x01→'01'（画面では start を付けて '501' 等）、cricket→'CRICKET'、countup→'COUNT-UP'
```
- [ ] **Step 1: 失敗するテスト:** T20,SB,DB → 160。8ラウンド既定。`limitWinners` は最高点（同点は複数）。`finished` は返さない。
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: Commit** `feat: count-up and game registry`

### Task 7: 試合エンジン（ターン・チーム・レグ・取り消し）

**Files:**
- Create: `src/match/types.ts`, `src/match/engine.ts`
- Test: `src/match/engine.test.ts`

**Interfaces:**
- Consumes: `GAMES`（Task 6）、`Dart`
- Produces:
```ts
// match/types.ts
export interface PlayerRef { playerId: string | null; name: string }   // ゲストは playerId=null
export interface SideConfig { name: string; members: PlayerRef[] }    // 個人戦はメンバー1人のサイド
export interface MatchConfig { gameId: GameId; options: GameOptions; mode: 'single' | 'team'; sides: SideConfig[]; legsToWin: number }
export type MatchEvent = { t: 'dart'; d: Dart } | { t: 'next' };
export interface ThrowRecord { leg: number; round: number; side: number; player: PlayerRef; idx: 0 | 1 | 2; dart: Dart; bust: boolean }
export interface TurnSummary { side: number; player: PlayerRef; darts: Dart[]; bust: boolean; finished: boolean; closedBefore?: number[]; marks?: number } // closedBefore/marks はクリケットのみ（CricketState から engine が詰める）
export interface MatchState {
  config: MatchConfig;
  leg: number; legWins: number[]; legStarter: number;
  round: number;              // 1始まり
  order: number[];            // このレグの投げ順（サイド番号）
  turnPos: number;            // order の何番目が投げているか
  memberPos: number[];        // 各サイドで次に投げるメンバー
  turnDarts: Dart[];
  turnComplete: boolean;      // 3投 / bust / 上がり で true。'next' 待ち
  legOver: boolean; legWinners: number[] | null;
  matchOver: boolean; matchWinner: number | null;
  game: unknown;
  throws: ThrowRecord[];
  lastTurn: TurnSummary | null;   // 演出判定用（直前に完了したターン）
}
// match/engine.ts
export function newMatch(config: MatchConfig): MatchState;
export function apply(s: MatchState, e: MatchEvent): MatchState;           // turnComplete 中の 'dart' と、未完了での 'next' 以外の不正イベントは無視
export function replay(config: MatchConfig, events: MatchEvent[]): MatchState;
export function currentSide(s: MatchState): number;
export function currentPlayer(s: MatchState): PlayerRef;
```
ルール（spec §6）: レグ k（0始まり）の先攻は `k mod サイド数`、投げ順はそこから回す。ラウンドは全サイドが1ターン投げたら +1。`'next'` は 3投未満でも受け付け、ターンを終える（残り投は投げなかった扱い）。ラウンド上限を超えたら `limitWinners`。勝者が1サイドならそのサイドに legWin、複数（引き分け）なら誰にも付けない。`legWins[i] >= legsToWin` で matchOver。レグ終了後の `'next'` で次レグ開始（ゲーム状態・ラウンド・メンバー順をリセット）。取り消しは UI が `replay(config, events.slice(0,-1))` を使う（engine に undo 関数は作らない）。

- [ ] **Step 1: 失敗するテストを書く**
  - 個人戦2人 501: A が 3投 → `turnComplete`、`'next'` で B の番、両者投げたら round 2
  - `'next'` で 3投未満のままターン終了できる
  - 01 で上がり → `legOver`, `legWinners=[0]`, legsToWin=1 なら `matchOver`, `matchWinner=0`
  - `unequal teams rotate members independently`: チーム A[a1,a2] vs B[b1,b2,b3] の投げ手順が a1,b1,a2,b2,a1,b3,a2,b1
  - レグ制 legsToWin=2: 2レグ目の先攻は B
  - ラウンド上限到達で `limitWinners` が適用される（カウントアップ 8R 後に終了）。同点ならどちらにも legWin が付かず次レグへ
  - `undo across turn, bust and leg boundaries`: 任意のイベント列で `replay(cfg, ev.slice(0,-1))` が「最後の1イベント前に `apply` を順に適用した状態」と deepEqual。対象: ターン切替直後、bust 直後、上がり直後、レグ切替直後
  - `replay is deterministic`: 同じイベント列の replay 2回が deepEqual
  - `throws` にチーム戦の各投が正しい `player` と `bust` 付きで残る（bust ターンの全投が `bust:true`）
- [ ] **Step 2:** FAIL → **Step 3:** 実装（状態はイミュータブルに扱う。ゲーム状態はルールの関数で更新）→ **Step 4:** PASS
- [ ] **Step 5: Commit** `feat: match engine with teams, legs and replay`

### Task 8: アワード判定

**Files:**
- Create: `src/awards/awards.ts`
- Test: `src/awards/awards.test.ts`

**Interfaces:**
- Consumes: `Dart`, `points`, `marksOf`, `TurnSummary`
- Produces:
```ts
export type AwardId = 'TON80' | 'HIGH_TON' | 'LOW_TON' | 'HAT_TRICK' | 'THREE_IN_THE_BLACK' | 'THREE_IN_A_BED'
  | 'WHITE_HORSE' | 'NINE_MARKS' | 'EIGHT_MARKS' | 'SEVEN_MARKS' | 'SIX_MARKS' | 'FIVE_MARKS';
export type MinorEffect = 'BULL' | 'BUST' | 'GAME_SHOT' | 'WIN';
export const AWARD_LABEL: Record<AwardId, string>; // 'TON 80!','HIGH TON','LOW TON','HAT TRICK','THREE IN THE BLACK','THREE IN A BED','WHITE HORSE','9 MARKS'…'5 MARKS'
export function detectAward(family: 'x01' | 'cricket' | 'countup', darts: Dart[], ctx: { bust: boolean; bull: BullMode; closedBefore?: number[]; marks?: number }): AwardId | null; // ctx は TurnSummary から作る
```
判定（spec §7.1）。3投そろったターンのみ（`darts.length === 3`）。bust ならアワードなし。
- x01/countup の優先順: TON80（T20×3）> THREE_IN_THE_BLACK（DB×3）> HAT_TRICK（ブル×3）> THREE_IN_A_BED（同 ring・同 num ×3、ブル以外）> HIGH_TON（151〜179）> LOW_TON（100〜150）
- cricket の優先順: WHITE_HORSE（15〜20 の異なる数字のトリプル3本、どれも `closedBefore` に含まれない）> THREE_IN_THE_BLACK > HAT_TRICK > n MARKS（`ctx.marks` が 5〜9）> THREE_IN_A_BED（クリケットナンバーのみ）

- [ ] **Step 1: 失敗するテスト:** T20×3→TON80、T20,T20,T19→HIGH_TON（177）、T20,S20,S20→LOW_TON（100）、S20×3→THREE_IN_A_BED、SB,SB,DB（fat 150）→HAT_TRICK、DB×3→THREE_IN_THE_BLACK、bust→null、2投→null、cricket T20,T19,T18 closedBefore=[]→WHITE_HORSE、closedBefore=[20]・marks=9 → NINE_MARKS、cricket marks=4→null
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: Commit** `feat: award detection`

### Task 9: 保存（IndexedDB）とエクスポート／インポート

**Files:**
- Create: `src/storage/db.ts`
- Test: `src/storage/db.test.ts`（先頭で `import 'fake-indexeddb/auto'`）

**Interfaces:**
- Consumes: `MatchConfig`, `MatchEvent`
- Produces:
```ts
export interface Player { id: string; name: string; color: string; createdAt: number }
export interface MatchRecord { id: string; startedAt: number; finishedAt: number; config: MatchConfig; events: MatchEvent[]; legWins: number[]; winner: number | null }
export interface CurrentMatch { id: string; startedAt: number; config: MatchConfig; events: MatchEvent[] }
export interface Settings { sfx: boolean; volume: number; effects: 'full' | 'lite' | 'off'; autoAdvance: boolean; defaultBull: BullMode }
export const DEFAULT_SETTINGS: Settings; // { sfx:true, volume:0.7, effects:'full', autoAdvance:true, defaultBull:'fat' }
export interface ExportData { app: 'darts-scorer'; version: 1; exportedAt: number; players: Player[]; matches: MatchRecord[]; settings: Settings }
export function openDb(name?: string): Promise<Db>;  // DB名既定 'darts-scorer'、stores: players, matches(index finishedAt), kv
export interface Db {
  listPlayers(): Promise<Player[]>; putPlayer(p: Player): Promise<void>; deletePlayer(id: string): Promise<void>;
  listMatches(): Promise<MatchRecord[]>; putMatch(m: MatchRecord): Promise<void>;
  getCurrent(): Promise<CurrentMatch | null>; setCurrent(c: CurrentMatch | null): Promise<void>;
  getSettings(): Promise<Settings>; setSettings(s: Settings): Promise<void>;
  exportAll(): Promise<ExportData>; importAll(d: unknown): Promise<void>;  // 形式不正なら Error('invalid file')。成功時は全置換
  clearAll(): Promise<void>;
}
```
プレイヤー削除時、過去の試合記録は残す（PlayerRef に名前を持っているため表示できる）。

- [ ] **Step 1: 失敗するテスト:** players の put/list/delete、matches の put/list（finishedAt 降順）、`current match round-trips events`（events 50個を set→get で同一）、`setCurrent(null)` で消える、settings 未保存時は DEFAULT_SETTINGS、`exportAll`→`clearAll`→`importAll` で元通り、`importAll({app:'x'})` は reject
- [ ] **Step 2:** FAIL → **Step 3:** 実装（`idb` を使用。テストごとに別 DB 名）→ **Step 4:** PASS
- [ ] **Step 5: Commit** `feat: indexeddb storage with export/import`

### Task 10: 成績集計

**Files:**
- Create: `src/stats/stats.ts`
- Test: `src/stats/stats.test.ts`

**Interfaces:**
- Consumes: `MatchRecord`, `replay`, `ThrowRecord`, `detectAward`, `points`, `marksOf`
- Produces:
```ts
export type StatKey = string;   // 'x01-501' 'x01-301' … / 'cricket' / 'countup'。01 は start ごとに分ける
export interface GamePoint { matchId: string; date: number; value: number; won: boolean }
export interface GameStats { key: StatKey; label: string; metric: 'PPD' | 'MPR' | 'SCORE'; points: GamePoint[]; avg: number; max: number; count: number; winRate: number | null }
export interface PlayerStats { playerId: string; games: GameStats[]; awards: Partial<Record<AwardId, number>> }
export function statKeyOf(c: MatchConfig): StatKey;
export function playerStats(playerId: string, matches: MatchRecord[]): PlayerStats;
```
1試合1点（値はその試合のその人の全投から計算）。
- 01: PPD = 有効得点合計 / 投数（bust ターンの得点は0、投数には数える。double in で未オープン中の投も得点0で数える）。小数2桁。
- クリケット: MPR = 有効マーク合計 × 3 / 投数。小数2桁。
- カウントアップ: その人の合計点（チーム戦なら本人が投げた分の合計）。
- `winRate`: 2サイド以上の試合のみで計算、1人練習のみなら `null`。`points` は日付昇順。awards はターン単位で `detectAward` を数える。

- [ ] **Step 1: 失敗するテスト:** 01 501 で 3ラウンド 60,60,bust(T20 等) → PPD = 120/9 = 13.33。カウントアップ 2試合 [500, 620] → avg 560, max 620, count 2。ゲストのみの試合は対象外。winRate はソロ試合を除外。TON80 を含む試合で awards.TON80 = 1。statKeyOf は 301 と 501 を区別
- [ ] **Step 2:** FAIL → **Step 3:** 実装 → **Step 4:** PASS
- [ ] **Step 5: Commit** `feat: player stats`

### Task 11: プレイ画面（ボード入力・スコア表示・演出・効果音）

**Files:**
- Create: `src/ui/components/Board.tsx`, `src/ui/components/X01Board.tsx`, `src/ui/components/CricketBoard.tsx`, `src/ui/components/AwardOverlay.tsx`, `src/audio/sfx.ts`, `src/ui/screens/Play.tsx`
- Modify: `src/styles/neon.css`, `src/ui/App.tsx`（仮で固定の 501 2人対戦を開いて確認できるようにする）

**Interfaces:**
- Consumes: `hitTest`, `label`, `onKey`/`flush`, `apply`/`replay`/`currentPlayer`, `detectAward`, `checkoutHint`, `Db.setCurrent`
- Produces:
```ts
// Board.tsx
export function Board(props: { onDart: (d: Dart) => void; highlight?: Dart[] }): JSX.Element;
// sfx.ts
export function unlockAudio(): void;  // ユーザー操作内で呼ぶ（iOS 対策）
export function playSfx(name: 'hit' | 'bull' | 'bust' | 'award' | 'bigAward' | 'win', volume: number): void;
// AwardOverlay.tsx
export function AwardOverlay(props: { effect: AwardId | MinorEffect | null; onDone: () => void; level: Settings['effects'] }): JSX.Element | null;
// Play.tsx
export function Play(props: { db: Db; current: CurrentMatch; settings: Settings; onFinished: (m: MatchRecord) => void; onQuit: () => void }): JSX.Element;
```
仕様:
- `Board`: SVG で描画（ネオン配色、モックアップ `content/visual-style.html` の A 案）。pointerdown〜move の間、指の上方にルーペ（2.5倍の拡大円）と選択中ラベルを表示、pointerup で `hitTest` して確定。`pointercancel` では確定しない。ボード外（数字リング部分を含む r>1）で離したら MISS。マウスでも同じ。
- `Play`: 上部にサイド一覧（手番をマゼンタのグロー）、大きなスコア、R n/上限、3投欄、ボタン `MISS` / `戻す` / `次へ`。01 では `checkoutHint` を残り170以下で表示。クリケットは `CricketBoard`（／ × ⊗ のマーク表）。
- イベントごとに `db.setCurrent({...current, events})` で保存。`戻す` は `events.slice(0,-1)` で replay。
- ターン完了時: `detectAward` → あれば `AwardOverlay`（大演出 TON80/HAT_TRICK/THREE_IN_THE_BLACK/WHITE_HORSE/NINE_MARKS/EIGHT_MARKS は約2.0秒、その他約1.2秒）。ブルの1投ごとに `BULL` 小演出（0.6秒）。bust で `BUST`、上がりで `GAME_SHOT`、試合終了で `WIN`。演出中のタップ・`Esc`・次の入力でスキップ。`settings.autoAdvance` なら演出終了後（演出なしなら 0.8 秒後）に自動で `'next'`。
- `effects:'lite'` は文字だけ短く、`'off'` は出さない。`sfx=false` なら無音。
- キーボード: `window` の keydown を `onKey` に流し、保留中は `DIGIT_WAIT_MS` 後に `flush`。
- 試合終了で `MatchRecord` を作り `db.putMatch` → `db.setCurrent(null)` → `onFinished`。

- [ ] **Step 1:** `npm test` で既存テストがすべて PASS のまま実装する（UI は自動テストなし）。
- [ ] **Step 2:** 実装。
- [ ] **Step 3: 手動確認（Browser pane）** `npm run dev` を開き、以下を確認してスクリーンショット:
  - 501 で T20 をタップ → 441。ルーペが出て、境界付近で指（ドラッグ）を動かすとラベルが変わる
  - T20×3 → `TON 80!` 演出、タップでスキップ。バーストで `BUST`
  - キーボード `t`,`2`,`0` / `Space` / `Backspace` / `Enter` が効く
  - 戻すでターン・バーストをまたいで戻れる
  - リロードしても同じ状態から再開（この段階では App が current を読み込むだけの仮実装でよい）
  - `resize_window` の mobile プリセット（375×812）で崩れない、横スクロールなし
  - 音はゲーム開始操作の後に鳴る（`unlockAudio` をボタンのクリックで呼ぶ）
- [ ] **Step 4: Commit** `feat: play screen with board input and award effects`

### Task 12: ホーム・プレイヤー管理・ゲーム選択・対戦設定・リザルト・設定

**Files:**
- Create: `src/ui/screens/Home.tsx`, `Players.tsx`, `GameSelect.tsx`, `MatchSetup.tsx`, `Result.tsx`, `Settings.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `Db`, `GAMES`, `defaultRoundsFor`, `MatchConfig`, `playerStats` は使わない（Task 13）
- Produces: `App` が画面 `'home' | 'players' | 'gameSelect' | 'setup' | 'play' | 'result' | 'stats' | 'settings'` を state で切替。

仕様（spec §4.1, §6）:
- **Home**: 「ゲーム開始」「続きから」（`getCurrent()` があるときだけ）「成績」「プレイヤー」「設定」。
- **Players**: 追加（名前・色8色から選択）、名前変更、削除（確認ダイアログ）。
- **GameSelect**: 01 / CRICKET / COUNT-UP。01 は start・IN・OUT・ブル・ラウンド上限、クリケットはラウンド上限（15/20/25）、カウントアップはオプションなし。ブル初期値は `settings.defaultBull`。
- **MatchSetup**: 個人戦/チーム戦の切替。個人戦は登録プレイヤーをタップで追加、「ゲスト追加」（名前は「ゲスト1」…、変更可）。最大 8 サイド。チーム戦はチーム数 2〜4、各チームにプレイヤーを割り当て（1人以上必須）。投げ順は上下ボタンで並べ替え＋「ランダム」。レグ数 1/2/3/5 先取（既定1）。1人だけでも開始可（練習）。「スタート」で `unlockAudio()` → current を作り Play へ。
- **Result**: 勝者をネオンで大きく表示、各プレイヤーのその試合の PPD/MPR/点数・アワード数、ボタン「もう一度」（同じ設定）「投げ順を入れ替えて」（order を1つ回す）「ホーム」。
- **Settings**: 効果音 ON/OFF・音量、演出（フル/簡易/なし）、自動で次へ、ブル既定値、エクスポート（`darts-scorer-YYYYMMDD.json` をダウンロード）、インポート（ファイル選択→確認→全置換、失敗時は「ファイルの形式が正しくありません」）、全データ削除（2段階確認）。

- [ ] **Step 1:** 実装。`npm test` PASS のまま。
- [ ] **Step 2: 手動確認（Browser pane, mobile プリセット）:** プレイヤー2人登録→01 501 個人戦→最後まで→リザルト→もう一度。チーム戦 2人 vs 3人で投げ手が表示どおり回る。ゲストを混ぜて開始できる。エクスポート→全削除→インポートで戻る。途中でリロード→ホームに「続きから」が出て再開できる。
- [ ] **Step 3: Commit** `feat: home, players, game select, setup, result, settings screens`

### Task 13: 成績画面

**Files:**
- Create: `src/ui/screens/Stats.tsx`, `src/ui/components/LineChart.tsx`
- Modify: `src/ui/App.tsx`

**Interfaces:**
- Consumes: `playerStats`, `PlayerStats`, `GameStats`, `Db.listMatches`, `Db.listPlayers`
- Produces: `LineChart(props: { points: { x: number; y: number }[]; yLabel: string }): JSX.Element`

仕様（spec §8.3）: プレイヤー選択 → ゲーム別タブ（記録があるものだけ）→ 推移グラフ（直近 10 / 30 / 全部 の切替）、平均・MAX・回数・勝率、試合履歴一覧（日付・値・勝敗）、アワード累計。記録が無いときは「まだ記録がありません」。グラフはシアンの線＋点、平均をマゼンタの破線。

- [ ] **Step 1:** 実装。`npm test` PASS のまま。
- [ ] **Step 2: 手動確認:** Task 12 で遊んだ試合が反映される。カウントアップを3回やって推移・平均・MAX が合っている（手計算と照合）。mobile 幅で崩れない。
- [ ] **Step 3: Commit** `feat: stats screen`

### Task 14: PWA 化と GitHub Pages 公開

**Files:**
- Create: `public/icons/icon-192.png`, `public/icons/icon-512.png`, `.github/workflows/deploy.yml`
- Modify: `vite.config.ts`, `index.html`

**Interfaces:**
- Consumes: 全体
- Produces: `https://taiki-iha.github.io/darts-scorer/`

- [ ] **Step 1:** `vite-plugin-pwa` を `registerType: 'autoUpdate'` で設定。manifest: `name: 'DARTS SCORER'`, `short_name: 'DARTS'`, `display: 'standalone'`, `background_color: '#05010f'`, `theme_color: '#05010f'`, `start_url` と `scope` は base に合わせる。アイコンはネオン調のダーツボードを SVG から PNG 化（192/512）。`index.html` に `apple-mobile-web-app-capable`, `apple-touch-icon`, `viewport-fit=cover` を追加。
- [ ] **Step 2:** `npm run build` → 成功。`npx vite preview --base /darts-scorer/` を Browser pane で開き、オフライン（Service Worker 登録済み）でリロードしても動くことを確認。
- [ ] **Step 3:** `deploy.yml`: `main` への push で `npm ci` → `npm test` → `npm run build` → `actions/upload-pages-artifact`（`dist`）→ `actions/deploy-pages`。
- [ ] **Step 4: ユーザー操作（必須）:** ユーザーに `gh auth login` で `taiki-iha` を追加してもらう（Claude は認証情報を入力しない）。その後 `gh auth switch -u taiki-iha`。
- [ ] **Step 5:** ユーザーの了承を得てから `gh repo create taiki-iha/darts-scorer --public --source . --push`、Pages のソースを GitHub Actions に設定（`gh api -X POST repos/taiki-iha/darts-scorer/pages -f build_type=workflow`）。終わったら `gh auth switch -u IharaTaiki` で元に戻す。
- [ ] **Step 6:** Actions が成功し、公開 URL が開けることを確認。スマホでの「ホーム画面に追加」の手順をユーザーに案内。
- [ ] **Step 7: Commit** `feat: pwa and github pages deploy`（Step 5 の前にコミットしておく）
