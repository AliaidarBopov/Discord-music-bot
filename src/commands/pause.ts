import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { musicManager } from "../music/MusicManager";

export const pauseCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("pause")
    .setDescription("Поставить воспроизведение на паузу"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = musicManager.getQueue(interaction.guildId!);
    const success = queue?.pause();

    await interaction.reply(
      success ? "⏸️ Пауза." : "⚠️ Нечего ставить на паузу."
    );
  },
};
