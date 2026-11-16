import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { musicManager } from "../music/MusicManager";

export const shuffleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("shuffle")
    .setDescription("Перемешать треки в очереди"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = musicManager.getQueue(interaction.guildId!);

    if (!queue || queue.tracks.length < 2) {
      await interaction.reply({
        content: "⚠️ Нечего перемешивать: в очереди меньше двух треков.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const count = queue.shuffle();
    await interaction.reply(`🔀 Очередь перемешана (${count} треков).`);
  },
};
