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
    // Глобальная регистрация — команды появятся на ВСЕХ серверах (~1 час)
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commands }
    );
    console.log("✅ Команды зарегистрированы глобально");

    console.log("✅ Команды успешно зарегистрированы!");
  } catch (err) {
    console.error("❌ Ошибка регистрации команд:", err);
  }
})();
