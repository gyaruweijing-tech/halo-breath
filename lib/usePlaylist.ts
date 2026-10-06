"use client";

import { useEffect, useRef, useState } from "react";

// 音楽プレイリスト = 状態（再生ロジック）を一箇所に閉じ込める。
// public/music/ のMP3を順に再生し、最後まで行ったら最初に戻ってループ。
// 音楽ON/OFFは localStorage に記憶。

const KEY_MUSIC = "halo-breath:music";

export function usePlaylist(tracks: string[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const idxRef = useRef(0);
  const musicOnRef = useRef(false);
  const [musicOn, setMusicOn] = useState(false);

  const srcFor = (i: number) => `/music/${encodeURIComponent(tracks[i])}`;

  useEffect(() => {
    if (tracks.length === 0) return;

    const audio = new Audio();
    audio.preload = "auto";
    audioRef.current = audio;

    // 全曲読み込み失敗時に error→次へ→error… と暴走しないための保険
    let errorStreak = 0;

    const playIndex = (i: number) => {
      idxRef.current = i;
      audio.src = srcFor(i);
      audio.play().catch(() => {}); // 失敗は error / kick 側で面倒を見る
    };

    // 1曲終わったら次へ。最後なら先頭へ戻ってループ。
    const onEnded = () => {
      errorStreak = 0;
      playIndex((idxRef.current + 1) % tracks.length);
    };

    // 読み込み/再生に失敗した曲は飛ばして次へ（壊れた1曲でループを止めない）。
    // 全曲ダメなときは tracks.length 回で打ち切って暴走を防ぐ。
    const onError = () => {
      if (errorStreak++ < tracks.length) {
        playIndex((idxRef.current + 1) % tracks.length);
      }
    };

    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    // 自動再生ブロック対策：保存状態がONなら再生を試み、ブロックされた時"だけ"
    // 「最初の1タップ」で復帰する（毎タップでは play() を呼ばない＝色変えタップと競合させない）。
    let kick: (() => void) | null = null;
    const armKick = () => {
      kick = () => {
        if (kick) window.removeEventListener("pointerdown", kick);
        kick = null;
        if (musicOnRef.current) audio.play().catch(() => {});
      };
      window.addEventListener("pointerdown", kick);
    };

    if (localStorage.getItem(KEY_MUSIC) === "on") {
      musicOnRef.current = true;
      setMusicOn(true);
      idxRef.current = 0;
      audio.src = srcFor(0);
      audio.play().catch(armKick);
    }

    return () => {
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (kick) window.removeEventListener("pointerdown", kick);
      audio.pause();
      audioRef.current = null;
    };
  }, [tracks]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || tracks.length === 0) return;
    const next = !musicOnRef.current;
    musicOnRef.current = next;
    setMusicOn(next);
    localStorage.setItem(KEY_MUSIC, next ? "on" : "off");
    if (next) {
      if (!audio.src) audio.src = srcFor(idxRef.current);
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  };

  return { musicOn, toggle, hasTracks: tracks.length > 0 };
}
