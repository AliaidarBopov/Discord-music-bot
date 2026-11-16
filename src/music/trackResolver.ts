import { EmbedBuilder } from "discord.js";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { Track } from "../types/music";

type SearchableVideo = {
  title?: string | null;
  url: string;
  durationInSec?: number | string | null;
  channel?: { name?: string | null } | null;
  thumbnails?: Array<{ url: string }> | null;
};

export async function resolveTracks(query: string, requestedBy: string): Promise<Track[]> {
  try {
    const isUrl = query.startsWith("https://") || query.startsWith("http://");

    if (isUrl) {
      const playlistTracks = await resolvePlaylistTracks(query, requestedBy);
      if (playlistTracks.length > 0) {
        return playlistTracks;
      }

      const track = await resolveSingleTrack(query, requestedBy);
      return track ? [track] : [];
    }

    const track = await resolveSingleTrack(query, requestedBy);
    return track ? [track] : [];
  } catch (error) {
    console.error("[resolveTracks] Failed to resolve tracks:", error);
    return [];
  }
}

export async function resolveSingleTrack(query: string, requestedBy: string): Promise<Track | null> {
  try {
    const isUrl = query.startsWith("https://") || query.startsWith("http://");

    if (isUrl) {
      const video = await ytDlpResolveSingle(query);
      return video ? mapVideoToTrack(video, requestedBy) : null;
    }

    const video = await ytDlpResolveSingle(`ytsearch1:${query}`);
    return video ? mapVideoToTrack(video, requestedBy) : null;
  } catch (error) {
    console.error("[resolveSingleTrack] Failed to resolve single track:", error);
    return null;
  }
}

export async function resolvePlaylistTracks(query: string, requestedBy: string): Promise<Track[]> {
  const url = parseUrlSafe(query);
  if (!url) return [];

  const isYouTubeHost = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i.test(url.hostname);
  if (!isYouTubeHost) return [];

  const listId = url.searchParams.get("list");
  const isPlaylistPath = url.pathname.includes("/playlist");

  if (!isPlaylistPath && !listId) return [];

  const playlistUrl = listId
    ? `https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`
    : query;

  try {
    const json = await ytDlpDumpSingleJson([
      "--flat-playlist",
      "--dump-single-json",
      "--no-playlist", // we want playlist entries only, not nested playlists
      playlistUrl,
    ]);

    const entries = Array.isArray(json?.entries) ? json.entries : [];
    const videos = entries
      .map((entry: any): SearchableVideo | null => ytDlpEntryToSearchableVideo(entry))
      .filter((video: SearchableVideo | null): video is SearchableVideo => Boolean(video?.url));

    return videos.map((video: SearchableVideo) => mapVideoToTrack(video, requestedBy));
  } catch (error) {
    console.error("[resolvePlaylistTracks] Failed to resolve playlist:", error);
    return [];
  }
}

export async function resolveRandomTrack(
  queries: readonly string[],
  requestedBy: string
): Promise<Track | null> {
  const shuffledQueries = [...queries];
  shuffleInPlace(shuffledQueries);

  for (const query of shuffledQueries) {
    const track = await resolveSingleTrack(query, requestedBy);
    if (track) {
      return track;
    }
  }

  return null;
}

export function createQueuedTrackEmbed(track: Track, position: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x4f8cff)
    .setTitle("Трек добавлен в очередь")
    .setDescription(`[${track.title}](${track.url})`)
    .addFields(
      { name: "Исполнитель", value: track.artist ?? "Неизвестно", inline: true },
      { name: "Длительность", value: track.duration, inline: true },
      { name: "Позиция", value: `#${position}`, inline: true },
      { name: "Запросил", value: track.requestedBy, inline: true }
    )
    .setFooter({ text: "FreedomTimaMusic • Очередь обновлена" })
    .setTimestamp();

  if (track.thumbnailUrl) {
    embed.setThumbnail(track.thumbnailUrl);
  }

  return embed;
}

export function createQueuedCollectionEmbed(
  tracks: Track[],
  startPosition: number,
  endPosition: number
): EmbedBuilder {
  const firstTrack = tracks[0];
  const totalDuration = sumDurations(tracks);

  const embed = new EmbedBuilder()
    .setColor(0x2eaf7d)
    .setTitle("Плейлист добавлен")
    .setDescription(`Добавлено **${tracks.length}** треков в очередь`)
    .addFields(
      { name: "Диапазон", value: `#${startPosition} - #${endPosition}`, inline: true },
      { name: "Суммарно", value: totalDuration, inline: true },
      { name: "Первый трек", value: `[${firstTrack.title}](${firstTrack.url})` }
    )
    .setFooter({ text: "FreedomTimaMusic • Playlist mode" })
    .setTimestamp();

  if (firstTrack.thumbnailUrl) {
    embed.setThumbnail(firstTrack.thumbnailUrl);
  }

  return embed;
}

function mapVideoToTrack(video: SearchableVideo, requestedBy: string): Track {
  return {
    title: video.title ?? "Неизвестный трек",
    url: video.url,
    duration: formatDuration(video.durationInSec ?? 0),
    requestedBy,
    artist: video.channel?.name ?? undefined,
    thumbnailUrl: video.thumbnails?.[video.thumbnails.length - 1]?.url,
  };
}

function parseUrlSafe(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function formatDuration(secondsValue: number | string | null | undefined): string {
  const totalSeconds = Math.max(0, Number(secondsValue) || 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function sumDurations(tracks: Track[]): string {
  const totalSeconds = tracks.reduce((sum, track) => sum + parseDuration(track.duration), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseDuration(duration: string): number {
  const chunks = duration.split(":").map((part) => Number(part));
  if (chunks.some((value) => Number.isNaN(value))) return 0;

  if (chunks.length === 2) {
    return chunks[0] * 60 + chunks[1];
  }

  if (chunks.length === 3) {
    return chunks[0] * 3600 + chunks[1] * 60 + chunks[2];
  }

  return 0;
}

function shuffleInPlace<T>(values: T[]): void {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
}

function getYtDlpPath(): string {
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

function getCookiesArgs(): string[] {
  const cookiesPath = (process.env.YTDLP_COOKIES ?? "").trim();
  if (!cookiesPath) return [];
  if (!fs.existsSync(cookiesPath)) {
    console.warn(`[trackResolver] YTDLP_COOKIES file not found: ${cookiesPath}`);
    return [];
  }
  return ["--cookies", cookiesPath];
}

async function ytDlpDumpSingleJson(args: string[]): Promise<any> {
  const ytDlpPath = getYtDlpPath();
  const baseArgs = [
    "--quiet",
    "--no-warnings",
    "--no-call-home",
    "--no-check-certificate",
    "--socket-timeout",
    "15",
    "--retries",
    "2",
    // YouTube requires solving JS challenges; without a runtime some formats are missing
    "--js-runtimes",
    `node:${process.execPath}`,
    ...getCookiesArgs(),
  ];

  const stdout = await new Promise<string>((resolve, reject) => {
    const proc = spawn(ytDlpPath, [...baseArgs, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let out = "";
    let err = "";

    proc.stdout.on("data", (d) => {
      out += d.toString();
    });

    proc.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 20_000) err = err.slice(-20_000);
    });

    proc.on("error", (e) => reject(e));
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(out.trim());
        return;
      }

      reject(new Error(err.trim() || `yt-dlp exited with code ${code}`));
    });
  });

  if (!stdout) throw new Error("yt-dlp returned empty JSON");
  return JSON.parse(stdout);
}

function ytDlpEntryToSearchableVideo(entry: any): SearchableVideo | null {
  if (!entry) return null;

  const url =
    typeof entry.webpage_url === "string"
      ? entry.webpage_url
      : typeof entry.url === "string" && /^https?:\/\//i.test(entry.url)
        ? entry.url
        : typeof entry.id === "string"
          ? `https://www.youtube.com/watch?v=${entry.id}`
          : typeof entry.url === "string"
            ? `https://www.youtube.com/watch?v=${entry.url}`
            : "";

  if (!url) return null;

  const thumbnails: Array<{ url: string }> = [];
  if (typeof entry.thumbnail === "string") thumbnails.push({ url: entry.thumbnail });
  if (Array.isArray(entry.thumbnails)) {
    for (const t of entry.thumbnails) {
      if (t && typeof t.url === "string") thumbnails.push({ url: t.url });
    }
  }

  return {
    title: typeof entry.title === "string" ? entry.title : null,
    url,
    durationInSec: entry.duration ?? null,
    channel: {
      name:
        typeof entry.uploader === "string"
          ? entry.uploader
          : typeof entry.channel === "string"
            ? entry.channel
            : null,
    },
    thumbnails: thumbnails.length ? thumbnails : null,
  };
}

async function ytDlpResolveSingle(input: string): Promise<SearchableVideo | null> {
  // For URLs this returns the video's JSON.
  // For ytsearch1:... it may return either a single video JSON or a playlist-like JSON with entries.
  const json = await ytDlpDumpSingleJson(["--dump-single-json", "--no-playlist", input]);

  const candidate = Array.isArray(json?.entries) ? json.entries.find(Boolean) : json;
  return ytDlpEntryToSearchableVideo(candidate);
}
