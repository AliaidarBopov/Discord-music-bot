import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { getPlaybackContext, queueTracksAndReply } from "./playbackCommandUtils";
import { resolveTracks } from "../music/trackResolver";

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Воспроизвести трек по названию или ссылке")
    .addStringOption((option) =>
      option
        .setName("запрос")
        .setDescription("Название песни, YouTube-ссылка или playlist URL")
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const context = await getPlaybackContext(interaction);
    if (!context) return;

    const query = interaction.options.getString("запрос", true);
    await interaction.deferReply({ ephemeral: true });

    const tracks = await resolveTracks(query, context.requestedBy);
    if (tracks.length === 0) {
      await interaction.editReply(`🔍 Ничего не найдено по запросу: **${query}**`);
      return;
    }

    await queueTracksAndReply(interaction, context, tracks);
  },
};
