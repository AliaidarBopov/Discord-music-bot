import { ChildProcess, spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { AUDIO_FORMAT, getCommonYtDlpArgs, getYtDlpPath } from "./ytDlp";

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
  process: ChildProcess;
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
    const filePath = path.join(PREFETCH_DIR, `${crypto.randomUUID()}.audio`);

    const proc = spawn(
      getYtDlpPath(),
      [
        "-f",
        AUDIO_FORMAT,
        "-o",
        filePath,
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
        url,
      ],
      { stdio: ["ignore", "ignore", "pipe"], windowsHide: true }
    );

    let stderr = "";
    proc.stderr?.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 5_000) stderr = stderr.slice(-5_000);
    });

    const done = new Promise<string | null>((resolve) => {
      proc.once("error", (err) => {
        console.warn("[prefetch] spawn error:", err);
        resolve(null);
      });
      proc.once("close", (code) => {
        if (code === 0 && fs.existsSync(filePath)) {
          console.log(`[prefetch] Ready: ${url}`);
          resolve(filePath);
          return;
        }
        if (this._entry?.process === proc) {
          console.warn(`[prefetch] Failed (${code}) for ${url}:`, stderr.trim());
        }
        removeFile(filePath);
        resolve(null);
      });
    });

    console.log(`[prefetch] Started: ${url}`);
    this._entry = { url, filePath, process: proc, done };
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

    if (entry.process.exitCode === null && !entry.process.killed) {
      entry.process.kill();
    }
    void entry.done.then((filePath) => {
      if (filePath) removeFile(filePath);
    });
  }
}

export function removeFile(filePath: string): void {
  fs.rm(filePath, { force: true }, () => {});
}
