"use client";

import { useEffect, useRef } from "react";

/**
 * useWakeLock — 画面スリープを防ぐ。
 *
 * 仕様メモ:
 * - 非対応ブラウザは何もしない（フォールバック不要。暗くなるだけ）。
 * - タブを離れて戻ると OS が自動解除するため、visibilitychange で再取得する。
 * - ブラウザによっては最初のユーザー操作後でないと取得できないため、
 *   画面タップ(pointerdown)でも（再）取得を試みる。
 *
 * @param active true の間だけ Wake Lock を保持する
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let cancelled = false;

    const acquire = async () => {
      // 表示中でないと request は弾かれる
      if (document.visibilityState !== "visible") return;
      if (sentinelRef.current) return; // 既に保持済み
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          sentinelRef.current = null;
        });
      } catch {
        // 取得失敗（未許可など）は無視。次のタップ/復帰で再挑戦する。
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointerdown", acquire);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointerdown", acquire);
      sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    };
  }, [active]);
}
