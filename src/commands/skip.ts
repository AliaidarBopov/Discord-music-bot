import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { musicManager } from "../music/MusicManager";

export const skipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Пропустить текущий трек"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = musicManager.getQueue(interaction.guildId!);

    if (!queue?.isPlaying) {
      await interaction.reply({ content: "⏹️ Сейчас ничего не играет.", ephemeral: true });
      return;
    }

    const skipped = queue.currentTrack?.title ?? "трек";
    const hasNext = queue.tracks.length > 0;
    queue.skip();

    await interaction.reply(
      hasNext
        ? `⏭️ Пропускаю **${skipped}**, играю следующий...`
        : `⏭️ Пропускаю **${skipped}**, очередь пуста.`
    );
  },
};
