import fs from "node:fs";
import path from "node:path";
import BreathView from "./BreathView";

// public/music/ の中の音源ファイルをビルド時に読み取り、
// ファイル名順に並べて client 側に渡す。
// （新しい曲を足したら再ビルド／dev中はリロードで反映される）
function getTracks(): string[] {
  try {
    const dir = path.join(process.cwd(), "public", "music");
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(mp3|ogg|m4a|aac|wav)$/i.test(f))
      .sort((a, b) => a.localeCompare(b, "ja", { numeric: true }));
  } catch {
    return [];
  }
}

export default function Page() {
  return <BreathView tracks={getTracks()} />;
}
