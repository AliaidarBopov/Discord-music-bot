import { EmbedBuilder } from "discord.js";
import play from "play-dl";
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
      const info = await play.video_info(query);
      return mapVideoToTrack(info.video_details as SearchableVideo, requestedBy);
    }

    const results = await play.search(query, { source: { youtube: "video" }, limit: 1 });
    const video = results[0];
    if (!video?.url) return null;

    return mapVideoToTrack(video as SearchableVideo, requestedBy);
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
    const playlist = await play.playlist_info(playlistUrl, { incomplete: true });
    const videos = await playlist.all_videos();

    return videos
      .filter((video) => Boolean(video?.url))
      .map((video) => mapVideoToTrack(video as SearchableVideo, requestedBy));
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
