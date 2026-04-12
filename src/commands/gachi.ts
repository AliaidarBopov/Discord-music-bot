import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { getPlaybackContext, queueTracksAndReply } from "./playbackCommandUtils";
import { resolveRandomTrack } from "../music/trackResolver";

const GACHI_QUERIES = [
  "gachi remix",
  "gachi right version",
  "gachi baka mitai",
  "gachi can you feel my heart",
  "gachi running in the 90s",
  "gachi slav king",
  "gachi never gonna give you up",
  "gachi haru yo koi",
  "gachi muks platinum",
  "gachi van darkholme remix",
] as const;

export const gachiCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("gachi")
    .setDescription("Включить случайный gachi-трек"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const context = await getPlaybackContext(interaction);
    if (!context) return;

    await interaction.deferReply({ ephemeral: true });

    const track = await resolveRandomTrack(GACHI_QUERIES, context.requestedBy);
    if (!track) {
      await interaction.editReply("🔍 Не удалось найти gachi-трек.");
      return;
    }

    await queueTracksAndReply(interaction, context, [track], {
      queuedSingleReply: "✅ Случайный gachi-трек добавлен в очередь.",
      startingSingleReply: "✅ Включаю случайный gachi-трек.",
    });
  },
};
