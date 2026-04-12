import "dotenv/config";
import { Client, GatewayIntentBits, Events, ChatInputCommandInteraction } from "discord.js";
import { commandHandler } from "./commands/CommandHandler";
import { playCommand } from "./commands/play";
import { mashupCommand } from "./commands/mashup";
import { gachiCommand } from "./commands/gachi";
import { playlistCommand } from "./commands/playlist";
import { skipCommand } from "./commands/skip";
import { stopCommand } from "./commands/stop";
import { pauseCommand } from "./commands/pause";
import { resumeCommand } from "./commands/resume";
import { queueCommand } from "./commands/queue";
import { handleMusicControlButton, isMusicControlButton } from "./commands/musicControls";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

[playCommand, mashupCommand, gachiCommand, playlistCommand, skipCommand, stopCommand, pauseCommand, resumeCommand, queueCommand]
  .forEach((cmd) => commandHandler.register(cmd));

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Бот запущен как ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton() && isMusicControlButton(interaction.customId)) {
    await handleMusicControlButton(interaction);
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  await commandHandler.handle(interaction as ChatInputCommandInteraction);
});

client.login(process.env.DISCORD_TOKEN);
