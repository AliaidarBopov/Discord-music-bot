import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { Command } from "./CommandHandler";
import { getPlaybackContext, queueTracksAndReply } from "./playbackCommandUtils";
import { resolveRandomTrack } from "../music/trackResolver";

const MASHUP_QUERIES = [
  "phonk mashup",
  "tiktok mashup remix",
  "nightcore mashup",
  "car music mashup",
  "best mashup remix",
  "brazilian phonk mashup",
  "drift phonk mashup",
  "sad mashup remix",
  "bass boosted mashup",
  "viral mashup remix",
] as const;

export const mashupCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("mashup")
    .setDescription("Включить случайный mashup-трек"),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const context = await getPlaybackContext(interaction);
    if (!context) return;

    await interaction.deferReply({ ephemeral: true });

    const track = await resolveRandomTrack(MASHUP_QUERIES, context.requestedBy);
    if (!track) {
      await interaction.editReply("🔍 Не удалось найти mashup-трек.");
      return;
    }

    await queueTracksAndReply(interaction, context, [track], {
      queuedSingleReply: "✅ Случайный mashup добавлен в очередь.",
      startingSingleReply: "✅ Включаю случайный mashup.",
    });
  },
};
