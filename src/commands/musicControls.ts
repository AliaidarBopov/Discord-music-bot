import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
} from "discord.js";
import { musicManager } from "../music/MusicManager";

export const MUSIC_CONTROL_CUSTOM_IDS = {
  toggle: "music_control_toggle",
  skip: "music_control_skip",
} as const;

export function createNowPlayingControlsRow(isPaused: boolean): ActionRowBuilder<ButtonBuilder> {
  const toggleLabel = isPaused ? "Продолжить" : "Пауза";
  const toggleEmoji = isPaused ? "▶️" : "⏸️";
  const toggleStyle = isPaused ? ButtonStyle.Success : ButtonStyle.Primary;

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_CUSTOM_IDS.toggle)
      .setEmoji(toggleEmoji)
      .setLabel(toggleLabel)
      .setStyle(toggleStyle),
    new ButtonBuilder()
      .setCustomId(MUSIC_CONTROL_CUSTOM_IDS.skip)
      .setLabel("Next")
      .setEmoji("⏩")
      .setStyle(ButtonStyle.Secondary)
  );
}

export function isMusicControlButton(customId: string): boolean {
  return Object.values(MUSIC_CONTROL_CUSTOM_IDS).includes(
    customId as (typeof MUSIC_CONTROL_CUSTOM_IDS)[keyof typeof MUSIC_CONTROL_CUSTOM_IDS]
  );
}

export async function handleMusicControlButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: "⚠️ Кнопки работают только на сервере.", ephemeral: true });
    return;
  }

  const queue = musicManager.getQueue(interaction.guildId);
  if (!queue) {
    await interaction.reply({ content: "⚠️ Сейчас ничего не играет.", ephemeral: true });
    return;
  }

  switch (interaction.customId) {
    case MUSIC_CONTROL_CUSTOM_IDS.toggle: {
      const success = queue.isPaused ? queue.resume() : queue.pause();
      if (!success) {
        await interaction.deferUpdate();
        return;
      }

      await interaction.update({
        components: [createNowPlayingControlsRow(queue.isPaused)],
      });
      return;
    }

    case MUSIC_CONTROL_CUSTOM_IDS.skip: {
      if (!queue.isPlaying) {
        await interaction.deferUpdate();
        return;
      }

      queue.skip();
      await interaction.update({
        components: [createNowPlayingControlsRow(false)],
      });
      return;
    }

    default: {
      await interaction.deferUpdate();
    }
  }
}
