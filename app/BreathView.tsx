"use client";

import { useEffect, useRef } from "react";
import { getBreathState } from "@/lib/breath";
import { useWakeLock } from "@/lib/useWakeLock";
import { usePlaylist } from "@/lib/usePlaylist";

// 光の色テーマ（シングルタップで切り替え）
const THEMES = [
  { name: "aqua", rgb: "130, 235, 245" }, // 青（お気に入り）
  { name: "amber", rgb: "255, 220, 120" }, // 黄色
  { name: "green", rgb: "130, 240, 165" }, // 緑（さわやかなミント）
];

// 背景モード（ダブルタップで切り替え）
const MODES = {
  dark: { bgInner: "#0b1018", bgOuter: "#05070d" }, // やわらか闇
  light: { bg: "#f4f1ea" }, // 朝の光（クリーム）
} as const;
type Mode = keyof typeof MODES;

const KEY_COLOR = "halo-breath:theme";
const KEY_MODE = "halo-breath:mode";
const DOUBLE_TAP_MS = 280;

export default function BreathView({ tracks }: { tracks: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(0);
  const modeRef = useRef<Mode>("dark");

  // 画面スリープ防止（自動スタートなので常に active）
  useWakeLock(true);

  // 音楽プレイリスト（ON/OFF切替・順次再生・ループ）
  const { musicOn, toggle, hasTracks } = usePlaylist(tracks);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 記憶した設定を復元
    const savedColor = Number(localStorage.getItem(KEY_COLOR));
    if (Number.isInteger(savedColor) && savedColor >= 0 && savedColor < THEMES.length) {
      themeRef.current = savedColor;
    }
    const savedMode = localStorage.getItem(KEY_MODE);
    if (savedMode === "dark" || savedMode === "light") {
      modeRef.current = savedMode;
    }

    // 背景モードを body にも反映（読み込み時のチラつき・オーバースクロール対策）
    const applyBodyBg = () => {
      document.body.style.background =
        modeRef.current === "light" ? MODES.light.bg : MODES.dark.bgOuter;
    };
    applyBodyBg();

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // --- タップ操作: シングル=色切替 / ダブル=背景切替 ---
    const cycleColor = () => {
      themeRef.current = (themeRef.current + 1) % THEMES.length;
      localStorage.setItem(KEY_COLOR, String(themeRef.current));
    };
    const toggleMode = () => {
      modeRef.current = modeRef.current === "dark" ? "light" : "dark";
      localStorage.setItem(KEY_MODE, modeRef.current);
      applyBodyBg();
    };

    let pendingTap: number | null = null;
    let lastTapTime = 0;
    const onPointerDown = () => {
      const now = performance.now();
      if (now - lastTapTime < DOUBLE_TAP_MS) {
        // ダブルタップ → 背景切替（保留中のシングルはキャンセル）
        if (pendingTap !== null) {
          clearTimeout(pendingTap);
          pendingTap = null;
        }
        lastTapTime = 0;
        toggleMode();
        return;
      }
      lastTapTime = now;
      pendingTap = window.setTimeout(() => {
        cycleColor();
        pendingTap = null;
      }, DOUBLE_TAP_MS);
    };
    window.addEventListener("pointerdown", onPointerDown);

    const start = performance.now();
    let raf = 0;

    const render = (now: number) => {
      const t = (now - start) / 1000;
      const breath = getBreathState(t);

      const cx = width / 2;
      const cy = height / 2;
      const base = Math.min(width, height);
      const maxR = base * 0.3;
      const minR = maxR * 0.42;
      const radius = minR + (maxR - minR) * breath.scale;
      const C = THEMES[themeRef.current].rgb;

      if (modeRef.current === "dark") {
        // --- やわらか闇: 暗い背景に滲む光 ---
        const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, base * 0.9);
        bg.addColorStop(0, MODES.dark.bgInner);
        bg.addColorStop(1, MODES.dark.bgOuter);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        const alpha = 0.45 + 0.55 * breath.scale;
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 2.05);
        glow.addColorStop(0, `rgba(${C}, ${0.98 * alpha})`);
        glow.addColorStop(0.35, `rgba(${C}, ${0.6 * alpha})`);
        glow.addColorStop(0.65, `rgba(${C}, ${0.2 * alpha})`);
        glow.addColorStop(1, `rgba(${C}, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 2.05, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // --- 朝の光: クリーム背景に柔らかい光の円 ---
        ctx.fillStyle = MODES.light.bg;
        ctx.fillRect(0, 0, width, height);

        const alpha = 0.55 + 0.4 * breath.scale;
        const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 1.35);
        disc.addColorStop(0, `rgba(${C}, ${0.95 * alpha})`);
        disc.addColorStop(0.55, `rgba(${C}, ${0.82 * alpha})`);
        disc.addColorStop(1, `rgba(${C}, 0)`);
        ctx.fillStyle = disc;
        ctx.beginPath();
        ctx.arc(cx, cy, radius * 1.35, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      if (pendingTap !== null) clearTimeout(pendingTap);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <main>
      <canvas ref={canvasRef} aria-hidden="true" />

      {hasTracks && (
        <button
          type="button"
          className="music-toggle"
          aria-label={musicOn ? "音楽を止める" : "音楽を流す"}
          aria-pressed={musicOn}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggle}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path
              d="M9 18V6l10-2v12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="6.5" cy="18" r="2.5" fill="currentColor" />
            <circle cx="16.5" cy="16" r="2.5" fill="currentColor" />
            {!musicOn && (
              <line
                x1="3"
                y1="3"
                x2="21"
                y2="21"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      )}

      <style jsx>{`
        main {
          position: fixed;
          inset: 0;
        }
        canvas {
          display: block;
        }
        .music-toggle {
          position: fixed;
          right: max(18px, env(safe-area-inset-right));
          bottom: max(18px, env(safe-area-inset-bottom));
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid rgba(235, 240, 245, 0.18);
          background: rgba(18, 22, 28, 0.38);
          color: ${musicOn ? "rgba(235, 240, 245, 0.92)" : "rgba(235, 240, 245, 0.5)"};
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          cursor: pointer;
          transition: color 0.3s ease, transform 0.15s ease;
        }
        .music-toggle:active {
          transform: scale(0.92);
        }
      `}</style>
    </main>
  );
}
