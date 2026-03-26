import "dotenv/config";
import { REST, Routes } from "discord.js";
import { playCommand } from "./commands/play";
import { skipCommand } from "./commands/skip";
import { stopCommand } from "./commands/stop";
import { pauseCommand } from "./commands/pause";
import { resumeCommand } from "./commands/resume";
import { queueCommand } from "./commands/queue";

const commands = [
  playCommand,
  skipCommand,
  stopCommand,
  pauseCommand,
  resumeCommand,
  queueCommand,
].map((cmd) => cmd.data.toJSON());

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log("🔄 Регистрирую slash-команды...");

    // Регистрация глобально (появится на всех серверах через ~1 час)
    // Для мгновенного появления на одном сервере используй Routes.applicationGuildCommands()
    const guilds = [process.env.GUILD_ID!, "440180837292441603"];

    for (const guildId of guilds) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId),
        { body: commands }
      );
      console.log(`✅ Команды зарегистрированы на сервере ${guildId}`);
    }

    console.log("✅ Команды успешно зарегистрированы!");
  } catch (err) {
    console.error("❌ Ошибка регистрации команд:", err);
  }
})();
