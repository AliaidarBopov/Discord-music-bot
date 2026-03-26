import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { musicManager } from "../music/MusicManager";

export const queueCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Показать текущую очередь воспроизведения"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = musicManager.getQueue(interaction.guildId!);

    if (!queue?.isPlaying) {
      await interaction.reply({ content: "📭 Очередь пуста.", ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🎵 Очередь воспроизведения")
      .setColor(0x1db954);

    if (queue.currentTrack) {
      const status = queue.isPaused ? "⏸️ На паузе" : "▶️ Сейчас играет";
      embed.addFields({
        name: status,
        value: `**${queue.currentTrack.title}** [${queue.currentTrack.duration}] — *${queue.currentTrack.requestedBy}*`,
      });
    }

    if (queue.tracks.length > 0) {
      const MAX_DISPLAY = 10;
      const displayed = queue.tracks.slice(0, MAX_DISPLAY);
      const remaining = queue.tracks.length - MAX_DISPLAY;

      const list = displayed
        .map((track, i) => `\`${i + 1}.\` **${track.title}** [${track.duration}] — *${track.requestedBy}*`)
        .join("\n");

      embed.addFields({
        name: `📋 В очереди (${queue.tracks.length})`,
        value: list + (remaining > 0 ? `\n...и ещё ${remaining} треков` : ""),
      });
    } else {
      embed.addFields({ name: "📋 В очереди", value: "Нет треков" });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
