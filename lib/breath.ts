// ============================================================
// 呼吸サイクル = invariant（不可侵のロジック）
// ここを「真実の源」として、描画も将来の音も "読むだけ" にする。
// このファイルは React にも Canvas にも依存しない純粋ロジック。
// ============================================================

/** 吸う時間（秒）: scale 0 → 1 */
export const INHALE = 4.0;
/** 吐く時間（秒）: scale 1 → 0 */
export const EXHALE = 6.0;
/** 1サイクルの長さ（秒） */
export const CYCLE = INHALE + EXHALE; // 10.0

export type BreathPhase = "inhale" | "exhale";

export type BreathState = {
  /** いま吸っているか吐いているか */
  phase: BreathPhase;
  /** サイクル内の経過秒（0〜CYCLE） */
  cycleElapsed: number;
  /** 円の大きさ・明るさに使う 0〜1 の値（呼吸の自然なカーブ済み） */
  scale: number;
};

/**
 * easeInOutSine — 呼吸の自然な加減速カーブ。
 * x: 0〜1 を受け取り 0〜1 を返す。
 */
export function easeInOutSine(x: number): number {
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

/**
 * getBreathState — 経過時間 t（秒）から、その瞬間の呼吸状態を返す純粋関数。
 *
 * 描画(Canvas)も将来の音(Web Audio)も、この関数を呼んで state を読むだけ。
 * → 「invariants as APIs / UI is one caller」。音の後付けが楽になるのはこの分離のおかげ。
 *
 * @param t アプリ開始からの経過秒（performance.now() ベースなどを想定）
 */
export function getBreathState(t: number): BreathState {
  // t を 0〜CYCLE に正規化（負の値が来ても安全に）
  const cycleElapsed = ((t % CYCLE) + CYCLE) % CYCLE;

  if (cycleElapsed < INHALE) {
    // 吸う: progress 0→1, scale 0→1
    const progress = cycleElapsed / INHALE;
    return {
      phase: "inhale",
      cycleElapsed,
      scale: easeInOutSine(progress),
    };
  }

  // 吐く: progress 0→1, scale 1→0
  const progress = (cycleElapsed - INHALE) / EXHALE;
  return {
    phase: "exhale",
    cycleElapsed,
    scale: 1 - easeInOutSine(progress),
  };
}
