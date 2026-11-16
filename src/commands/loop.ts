import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { musicManager } from "../music/MusicManager";
import { LoopMode } from "../types/music";

const LOOP_LABELS: Record<LoopMode, string> = {
  off: "➡️ Повтор выключен",
  track: "🔂 Повтор текущего трека",
  queue: "🔁 Повтор всей очереди",
};

export const loopCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("loop")
    .setDescription("Режим повтора")
    .addStringOption((option) =>
      option
        .setName("режим")
        .setDescription("Что повторять")
        .setRequired(true)
        .addChoices(
          { name: "Выключить", value: "off" },
          { name: "Текущий трек", value: "track" },
          { name: "Всю очередь", value: "queue" }
        )
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const queue = musicManager.getQueue(interaction.guildId!);

    if (!queue) {
      await interaction.reply({ content: "⏹️ Бот не в голосовом канале.", flags: MessageFlags.Ephemeral });
      return;
    }

    const mode = interaction.options.getString("режим", true) as LoopMode;
    queue.setLoopMode(mode);

    await interaction.reply(`${LOOP_LABELS[mode]}.`);
  },
};
