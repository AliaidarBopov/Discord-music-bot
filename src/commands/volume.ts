import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { musicManager } from "../music/MusicManager";
import { GuildQueue } from "../music/GuildQueue";

export const volumeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Показать или изменить громкость")
    .addIntegerOption((option) =>
      option
        .setName("уровень")
        .setDescription(`Громкость в процентах (${GuildQueue.MIN_VOLUME}–${GuildQueue.MAX_VOLUME}, 100 — обычная)`)
        .setMinValue(GuildQueue.MIN_VOLUME)
        .setMaxValue(GuildQueue.MAX_VOLUME)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = musicManager.getQueue(interaction.guildId!);

    if (!queue) {
      await interaction.reply({ content: "⏹️ Бот не в голосовом канале.", flags: MessageFlags.Ephemeral });
      return;
    }

    const level = interaction.options.getInteger("уровень");

    if (level === null) {
      await interaction.reply({ content: `🔊 Текущая громкость: **${queue.volume}%**`, flags: MessageFlags.Ephemeral });
      return;
    }

    const previous = queue.volume;
    const applied = queue.setVolume(level);
    const icon = applied < 50 ? "🔈" : applied <= 100 ? "🔉" : "🔊";

    await interaction.reply(`${icon} Громкость: **${previous}%** → **${applied}%**`);
  },
};
