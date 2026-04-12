import "dotenv/config";
import { REST, Routes } from "discord.js";
import { playCommand } from "./commands/play";
import { mashupCommand } from "./commands/mashup";
import { gachiCommand } from "./commands/gachi";
import { playlistCommand } from "./commands/playlist";
import { skipCommand } from "./commands/skip";
import { stopCommand } from "./commands/stop";
import { pauseCommand } from "./commands/pause";
import { resumeCommand } from "./commands/resume";
import { queueCommand } from "./commands/queue";

const commands = [
  playCommand,
  mashupCommand,
  gachiCommand,
  playlistCommand,
  skipCommand,
  stopCommand,
  pauseCommand,
  resumeCommand,
  queueCommand,
].map((cmd) => cmd.data.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
const clientId = process.env.CLIENT_ID!;
const guildId = process.env.GUILD_ID;

(async () => {
  try {
    if (guildId) {
      console.log("Registering slash commands for one guild...");
      await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      );
      console.log("Guild commands registered successfully.");
      return;
    }

    console.log("Registering global slash commands...");
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );
    console.log("Global commands registered successfully.");
  } catch (err) {
    console.error("Failed to register commands:", err);
  }
})();
