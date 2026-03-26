import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { musicManager } from "../music/MusicManager";

export const resumeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("resume")
    .setDescription("Продолжить воспроизведение после паузы"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = musicManager.getQueue(interaction.guildId!);
    const success = queue?.resume();

    await interaction.reply(
      success ? "▶️ Продолжаю воспроизведение." : "⚠️ Воспроизведение не на паузе."
    );
  },
};
