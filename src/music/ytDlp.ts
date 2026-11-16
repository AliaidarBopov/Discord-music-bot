import fs from "fs";
import path from "path";

/** Формат аудио: m4a обычно стабильнее webm при передаче через pipe */
export const AUDIO_FORMAT = "bestaudio[ext=m4a]/bestaudio/best";

export function getYtDlpPath(): string {
  return path.join(
    __dirname,
    "..",
    "..",
    "node_modules",
    "youtube-dl-exec",
    "bin",
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
  );
}

/** Аргументы, нужные для каждого запуска yt-dlp */
export function getCommonYtDlpArgs(): string[] {
  return [
    // YouTube requires solving JS challenges; without a runtime it returns 403
    "--js-runtimes",
    `node:${process.execPath}`,
    ...getCookiesArgs(),
  ];
}

function getCookiesArgs(): string[] {
  const cookiesPath = (process.env.YTDLP_COOKIES ?? "").trim();
  if (!cookiesPath) return [];
  if (!fs.existsSync(cookiesPath)) {
    console.warn(`[yt-dlp] YTDLP_COOKIES file not found: ${cookiesPath}`);
    return [];
  }
  return ["--cookies", cookiesPath];
}
