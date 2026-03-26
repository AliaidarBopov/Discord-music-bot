import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { musicManager } from "../music/MusicManager";

export const stopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Остановить воспроизведение и покинуть канал"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = musicManager.getQueue(interaction.guildId!);

    if (!queue) {
      await interaction.reply({ content: "⏹️ Бот не в голосовом канале.", ephemeral: true });
      return;
    }

    queue.stop();
    musicManager.deleteQueue(interaction.guildId!);
    await interaction.reply("⏹️ Воспроизведение остановлено, покидаю канал.");
  },
};
