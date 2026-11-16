import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export interface Command {
  data: SlashCommandBuilder;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

class CommandHandler {
  private readonly commands = new Map<string, Command>();

  public register(command: Command): void {
    this.commands.set(command.data.name, command);
  }

  public async handle(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[CommandHandler] Ошибка в команде "${interaction.commandName}":`, err);

      const msg = { content: `❌ Ошибка: \`${errorMessage}\``, ephemeral: true };

      const trySend = async (): Promise<void> => {
        if (interaction.deferred && !interaction.replied) {
          await interaction.editReply(msg);
          return;
        }

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(msg);
          return;
        }

        await interaction.reply(msg);
      };

      try {
        await trySend();
      } catch (sendErr: unknown) {
        // Common when the same interaction was already responded to (e.g., multiple bot instances)
        const code = (sendErr as { code?: number | string } | null)?.code;
        if (code === 40060) {
          try {
            await interaction.followUp(msg);
          } catch {
            // ignore
          }
          return;
        }

        console.error("[CommandHandler] Не удалось отправить сообщение об ошибке:", sendErr);
      }
    }
  }

  public getAll(): Command[] {
    // Уникальные команды (без дублей от aliases)
    return [...new Set(this.commands.values())];
  }
}

export const commandHandler = new CommandHandler();
