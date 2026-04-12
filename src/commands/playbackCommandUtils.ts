import {
  ChatInputCommandInteraction,
  GuildMember,
  TextChannel,
  VoiceChannel,
} from "discord.js";
import { musicManager } from "../music/MusicManager";
import {
  createQueuedCollectionEmbed,
  createQueuedTrackEmbed,
} from "../music/trackResolver";
import { Track } from "../types/music";

export interface PlaybackContext {
  requestedBy: string;
  textChannel: TextChannel;
  voiceChannel: VoiceChannel;
}

interface QueueReplyOptions {
  queuedCollectionReply?: string;
  queuedSingleReply?: string;
  startingCollectionReply?: string;
  startingSingleReply?: string;
}

export async function getPlaybackContext(
  interaction: ChatInputCommandInteraction
): Promise<PlaybackContext | null> {
  if (!interaction.guildId || !interaction.channel) {
    await interaction.reply({
      content: "⚠️ Эта команда работает только на сервере.",
      ephemeral: true,
    });
    return null;
  }

  const member = interaction.member as GuildMember;
  const voiceChannel = member?.voice?.channel as VoiceChannel | null;
  const textChannel = interaction.channel as TextChannel;

  if (!voiceChannel) {
    await interaction.reply({
      content: "🔇 Сначала зайди в голосовой канал.",
      ephemeral: true,
    });
    return null;
  }

  const permissions = voiceChannel.permissionsFor(interaction.client.user!);
  if (!permissions?.has("Connect") || !permissions.has("Speak")) {
    await interaction.reply({
      content: "🚫 У меня нет прав для подключения к этому каналу.",
      ephemeral: true,
    });
    return null;
  }

  return {
    requestedBy: member?.displayName ?? interaction.user.displayName,
    textChannel,
    voiceChannel,
  };
}

export async function queueTracksAndReply(
  interaction: ChatInputCommandInteraction,
  context: PlaybackContext,
  tracks: Track[],
  options: QueueReplyOptions = {}
): Promise<void> {
  const queue = await musicManager.getOrCreateQueue({
    guildId: interaction.guildId!,
    textChannel: context.textChannel,
    voiceChannel: context.voiceChannel,
  });

  const wasPlaying = queue.isPlaying;

  for (const track of tracks) {
    queue.enqueue(track);
  }

  if (wasPlaying) {
    if (tracks.length === 1) {
      const [track] = tracks;
      await context.textChannel.send({
        embeds: [createQueuedTrackEmbed(track, queue.tracks.length)],
      });

      await interaction.editReply(
        options.queuedSingleReply ?? "✅ Трек добавлен, сообщение отправлено в чат."
      );
      return;
    }

    const startPosition = queue.tracks.length - tracks.length + 1;
    await context.textChannel.send({
      embeds: [createQueuedCollectionEmbed(tracks, startPosition, queue.tracks.length)],
    });

    await interaction.editReply(
      options.queuedCollectionReply ?? "✅ Плейлист добавлен, сообщение отправлено в чат."
    );
    return;
  }

  queue.playNext().catch(console.error);

  await interaction.editReply(
    tracks.length === 1
      ? options.startingSingleReply ?? "✅ Запускаю трек. Сообщение для всех появится в чате."
      : options.startingCollectionReply ?? "✅ Запускаю плейлист. Сообщение для всех появится в чате."
  );
}
