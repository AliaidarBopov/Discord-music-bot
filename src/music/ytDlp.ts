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

/** Сколько раз пробовать скачать трек, если YouTube отвечает 403 */
export const YTDLP_MAX_ATTEMPTS = 3;

/**
 * YouTube иногда случайно отклоняет ссылку на аудио (HTTP 403).
 * Новый запуск yt-dlp получает новую ссылку и обычно проходит, а сам yt-dlp 403 не повторяет.
 */
export function isRetryableYtDlpError(stderr: string): boolean {
  return /HTTP Error 403|403: Forbidden/i.test(stderr);
}

/**
 * 403 от YouTube приходят волнами, поэтому перед повтором ждём, и чем дальше, тем дольше:
 * 1.5 с перед второй попыткой, 3 с перед третьей.
 */
export function ytDlpRetryDelay(failedAttempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1_500 * failedAttempt));
}

/** Последняя строка с ошибкой из вывода yt-dlp (для логов) */
export function lastYtDlpError(stderr: string): string {
  const errors = stderr.match(/ERROR:.*/g);
  return (errors?.[errors.length - 1] ?? stderr.trim().split("\n").pop() ?? "").trim();
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
