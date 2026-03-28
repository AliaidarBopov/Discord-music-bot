import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  VoiceChannel,
  TextChannel,
  GuildMember,
  EmbedBuilder,
} from "discord.js";
import play from "play-dl";
import { Command } from "./CommandHandler";
import { musicManager } from "../music/MusicManager";
import { Track } from "../types/music";

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Воспроизвести трек по названию или ссылке")
    .addStringOption((opt) =>
      opt
        .setName("запрос")
        .setDescription("Название песни или YouTube-ссылка")
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const member = interaction.member as GuildMember;
    const voiceChannel = member?.voice?.channel as VoiceChannel | null;

    if (!voiceChannel) {
      await interaction.reply({ content: "🔇 Сначала зайди в голосовой канал.", ephemeral: true });
      return;
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user!);
    if (!permissions?.has("Connect") || !permissions.has("Speak")) {
      await interaction.reply({ content: "🚫 У меня нет прав для подключения к этому каналу.", ephemeral: true });
      return;
    }

    const query = interaction.options.getString("запрос", true);

    // Даём Discord знать что обрабатываем запрос (поиск может занять время)
    await interaction.deferReply();

    const tracks = await resolveTracks(query, member?.displayName ?? interaction.user.displayName);

    if (!tracks.length) {
      await interaction.editReply(`🔍 Ничего не найдено по запросу: **${query}**`);
      return;
    }

    const queue = await musicManager.getOrCreateQueue({
      guildId: interaction.guildId!,
      voiceChannel,
      textChannel: interaction.channel as TextChannel,
    });

    for (const track of tracks) {
      queue.enqueue(track);
    }

    if (queue.isPlaying) {
      if (tracks.length === 1) {
        const [track] = tracks;
        await interaction.editReply({
          embeds: [createQueuedTrackEmbed(track, queue.tracks.length)],
        });
        return;
      }

      const startPosition = queue.tracks.length - tracks.length + 1;
      await interaction.editReply({
        embeds: [createQueuedCollectionEmbed(tracks, startPosition, queue.tracks.length)],
      });
      return;
    }

    // playNext() сам обрабатывает ошибки внутри — не ждём его завершения
    queue.playNext().catch(console.error);
    if (tracks.length === 1) {
      await interaction.editReply({
        embeds: [createNowPlayingStartEmbed(tracks[0])],
      });
      return;
    }

    await interaction.editReply({
      embeds: [createCollectionStartEmbed(tracks)],
    });
  },
};

const MAX_COLLECTION_TRACKS = 100;

async function resolveTracks(query: string, requestedBy: string): Promise<Track[]> {
  try {
    const isUrl = query.startsWith("https://") || query.startsWith("http://");

    if (isUrl) {
      const playlistTracks = await resolvePlaylistOrMixTracks(query, requestedBy);
      if (playlistTracks.length) {
        return playlistTracks;
      }

      const info = await play.video_info(query);
      const details = info.video_details;
      return [{
        title: details.title ?? "Неизвестный трек",
        url: details.url,
        duration: formatDuration(details.durationInSec),
        requestedBy,
        artist: details.channel?.name,
        thumbnailUrl: details.thumbnails?.[details.thumbnails.length - 1]?.url,
      }];
    } else {
      const results = await play.search(query, { source: { youtube: "video" }, limit: 1 });
      if (!results.length) return [];
      const video = results[0];
      return [{
        title: video.title ?? "Неизвестный трек",
        url: video.url,
        duration: formatDuration(video.durationInSec ?? 0),
        requestedBy,
        artist: video.channel?.name,
        thumbnailUrl: video.thumbnails?.[video.thumbnails.length - 1]?.url,
      }];
    }
  } catch (err) {
    console.error("[resolveTracks] Ошибка:", err);
    return [];
  }
}

async function resolvePlaylistOrMixTracks(query: string, requestedBy: string): Promise<Track[]> {
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
      .slice(0, MAX_COLLECTION_TRACKS)
      .map((video) => ({
        title: video.title ?? "Неизвестный трек",
        url: video.url,
        duration: formatDuration(video.durationInSec ?? 0),
        requestedBy,
        artist: video.channel?.name,
        thumbnailUrl: video.thumbnails?.[video.thumbnails.length - 1]?.url,
      }));
  } catch (err) {
    console.error("[resolvePlaylistOrMixTracks] Не удалось прочитать плейлист/микс:", err);
    return [];
  }
}

function parseUrlSafe(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function createQueuedTrackEmbed(track: Track, position: number): EmbedBuilder {
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
    .setFooter({ text: "VK Music Bot • Очередь обновлена" })
    .setTimestamp();

  if (track.thumbnailUrl) {
    embed.setThumbnail(track.thumbnailUrl);
  }

  return embed;
}

function createQueuedCollectionEmbed(tracks: Track[], startPosition: number, endPosition: number): EmbedBuilder {
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
    .setFooter({ text: "VK Music Bot • Playlist mode" })
    .setTimestamp();

  if (firstTrack.thumbnailUrl) {
    embed.setThumbnail(firstTrack.thumbnailUrl);
  }

  return embed;
}

function createNowPlayingStartEmbed(track: Track): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xff7a59)
    .setTitle("Запускаю воспроизведение")
    .setDescription(`[${track.title}](${track.url})`)
    .addFields(
      { name: "Исполнитель", value: track.artist ?? "Неизвестно", inline: true },
      { name: "Длительность", value: track.duration, inline: true },
      { name: "Запросил", value: track.requestedBy, inline: true }
    )
    .setFooter({ text: "Blya igraet ne vyebyvaisya" })
    .setTimestamp();

  if (track.thumbnailUrl) {
    embed.setThumbnail(track.thumbnailUrl);
  }

  return embed;
}

function createCollectionStartEmbed(tracks: Track[]): EmbedBuilder {
  const firstTrack = tracks[0];
  const totalDuration = sumDurations(tracks);

  const embed = new EmbedBuilder()
    .setColor(0xc96bff)
    .setTitle("Старт плейлиста")
    .setDescription(`Сейчас играет [${firstTrack.title}](${firstTrack.url})`)
    .addFields(
      { name: "Всего треков", value: `${tracks.length}`, inline: true },
      { name: "После текущего", value: `${tracks.length - 1}`, inline: true },
      { name: "Суммарно", value: totalDuration, inline: true }
    )
    .setFooter({ text: "VK Music Bot • Playlist flow" })
    .setTimestamp();

  if (firstTrack.thumbnailUrl) {
    embed.setThumbnail(firstTrack.thumbnailUrl);
  }

  return embed;
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
