import { ChatInputCommandInteraction, SlashCommandBuilder, VoiceChannel, TextChannel, GuildMember } from "discord.js";
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

    const track = await resolveTrack(query, member?.displayName ?? interaction.user.displayName);

    if (!track) {
      await interaction.editReply(`🔍 Ничего не найдено по запросу: **${query}**`);
      return;
    }

    const queue = await musicManager.getOrCreateQueue({
      guildId: interaction.guildId!,
      voiceChannel,
      textChannel: interaction.channel as TextChannel,
    });

    queue.enqueue(track);

    if (queue.isPlaying) {
      await interaction.editReply(
        `➕ Добавлено в очередь: **${track.title}** [${track.duration}] — позиция #${queue.tracks.length}`
      );
      return;
    }

    // playNext() сам обрабатывает ошибки внутри — не ждём его завершения
    queue.playNext().catch(console.error);
    await interaction.editReply(`▶️ Начинаю воспроизведение: **${track.title}**`);
  },
};

async function resolveTrack(query: string, requestedBy: string): Promise<Track | null> {
  try {
    const isUrl = query.startsWith("https://") || query.startsWith("http://");

    if (isUrl) {
      const info = await play.video_info(query);
      const details = info.video_details;
      return {
        title: details.title ?? "Неизвестный трек",
        url: details.url,
        duration: formatDuration(details.durationInSec),
        requestedBy,
      };
    } else {
      const results = await play.search(query, { source: { youtube: "video" }, limit: 1 });
      if (!results.length) return null;
      const video = results[0];
      return {
        title: video.title ?? "Неизвестный трек",
        url: video.url,
        duration: formatDuration(video.durationInSec ?? 0),
        requestedBy,
      };
    }
  } catch (err) {
    console.error("[resolveTrack] Ошибка:", err);
    return null;
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
