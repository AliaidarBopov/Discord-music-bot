import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { getPlaybackContext, queueTracksAndReply } from "./playbackCommandUtils";
import { resolvePlaylistTracks } from "../music/trackResolver";

export const playlistCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription("Добавить целый YouTube-плейлист в очередь")
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("Ссылка на YouTube playlist или mix")
        .setRequired(true)
    ) as SlashCommandBuilder,

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const context = await getPlaybackContext(interaction);
    if (!context) return;

    const url = interaction.options.getString("url", true);
    await interaction.deferReply({ ephemeral: true });

    const tracks = await resolvePlaylistTracks(url, context.requestedBy);
    if (tracks.length === 0) {
      await interaction.editReply("🔍 Не удалось прочитать плейлист. Проверь ссылку на YouTube playlist или mix.");
      return;
    }

    await queueTracksAndReply(interaction, context, tracks, {
      queuedCollectionReply: `✅ Плейлист из ${tracks.length} треков добавлен в очередь.`,
      queuedSingleReply: "✅ Трек из плейлиста добавлен в очередь.",
      startingCollectionReply: `✅ Запускаю плейлист из ${tracks.length} треков.`,
      startingSingleReply: "✅ Запускаю трек из плейлиста.",
    });
  },
};
