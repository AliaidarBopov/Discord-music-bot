import { ChildProcess, spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import {
  AUDIO_FORMAT,
  YTDLP_MAX_ATTEMPTS,
  getCommonYtDlpArgs,
  getYtDlpPath,
  isRetryableYtDlpError,
  lastYtDlpError,
  ytDlpRetryDelay,
} from "./ytDlp";

const PREFETCH_DIR = path.join(os.tmpdir(), "discord-music-bot-prefetch");

// Старые файлы от прошлых запусков больше не нужны
try {
  fs.rmSync(PREFETCH_DIR, { recursive: true, force: true });
} catch {
  // no-op
}

interface PrefetchEntry {
  url: string;
  filePath: string;
  /** Текущий процесс yt-dlp (меняется между попытками) */
  process: ChildProcess | null;
  cancelled: boolean;
  /** Путь к файлу, когда скачивание завершилось, или null при ошибке/отмене */
  done: Promise<string | null>;
}

/**
 * Заранее скачивает следующий трек во временный файл, пока играет текущий.
 * Тогда следующий трек стартует почти сразу, без ~10 с ожидания yt-dlp.
 */
export class TrackPrefetcher {
  private _entry: PrefetchEntry | null = null;

  /** Начинает подгрузку трека (повторный вызов с тем же url ничего не делает) */
  public prefetch(url: string | null): void {
    if (this._entry?.url === url) return;
    this.cancel();
    if (!url) return;

    fs.mkdirSync(PREFETCH_DIR, { recursive: true });
    const entry: PrefetchEntry = {
      url,
      filePath: path.join(PREFETCH_DIR, `${crypto.randomUUID()}.audio`),
      process: null,
      cancelled: false,
      done: Promise.resolve(null),
    };

    console.log(`[prefetch] Started: ${url}`);
    entry.done = this._download(entry);
    this._entry = entry;
  }

  /**
   * Забирает подгруженный файл для url (если подгрузка ещё идёт — дожидается её).
   * После этого файл принадлежит вызывающему, и удалить его должен он.
   */
  public async take(url: string): Promise<string | null> {
    const entry = this._entry;
    if (!entry || entry.url !== url) return null;
    this._entry = null;
    return entry.done;
  }

  /** Останавливает подгрузку и удаляет файл */
  public cancel(): void {
    const entry = this._entry;
    if (!entry) return;
    this._entry = null;
    entry.cancelled = true;

    const proc = entry.process;
    if (proc && proc.exitCode === null && !proc.killed) {
      proc.kill();
    }
    void entry.done.then((filePath) => {
      if (filePath) removeFile(filePath);
    });
  }

  private async _download(entry: PrefetchEntry): Promise<string | null> {
    for (let attempt = 1; attempt <= YTDLP_MAX_ATTEMPTS && !entry.cancelled; attempt += 1) {
      const result = await this._downloadOnce(entry);
      if (result.ok) {
        console.log(`[prefetch] Ready: ${entry.url}`);
        return entry.filePath;
      }
      if (entry.cancelled) break;

      const retryable = isRetryableYtDlpError(result.stderr);
      console.warn(
        `[prefetch] Attempt ${attempt}/${YTDLP_MAX_ATTEMPTS} failed for ${entry.url}: ${lastYtDlpError(result.stderr)}` +
          (retryable && attempt < YTDLP_MAX_ATTEMPTS ? " — retrying" : "")
      );
      if (!retryable) break;
      if (attempt < YTDLP_MAX_ATTEMPTS) await ytDlpRetryDelay(attempt);
    }

    removeFile(entry.filePath);
    return null;
  }

  private _downloadOnce(entry: PrefetchEntry): Promise<{ ok: boolean; stderr: string }> {
    return new Promise((resolve) => {
      const proc = spawn(
        getYtDlpPath(),
        [
          "-f",
          AUDIO_FORMAT,
          "-o",
          entry.filePath,
          "--quiet",
          "--no-warnings",
          "--no-playlist",
          "--no-part",
          "--force-overwrites",
          "--retries",
          "3",
          "--socket-timeout",
          "15",
          ...getCommonYtDlpArgs(),
          entry.url,
        ],
        { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }
      );
      entry.process = proc;

      let stderr = "";
      proc.stderr?.on("data", (d) => {
        stderr += d.toString();
        if (stderr.length > 5_000) stderr = stderr.slice(-5_000);
      });

      proc.once("error", (err) => resolve({ ok: false, stderr: String(err) }));
      proc.once("close", (code) => {
        resolve({ ok: code === 0 && fs.existsSync(entry.filePath), stderr });
      });
    });
  }
}

export function removeFile(filePath: string): void {
  fs.rm(filePath, { force: true }, () => {});
}
