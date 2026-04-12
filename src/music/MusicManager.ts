import { Collection } from "discord.js";
import {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from "@discordjs/voice";
import { GuildQueue } from "./GuildQueue";
import { GuildQueueOptions } from "../types/music";

class MusicManager {
  private readonly queues = new Collection<string, GuildQueue>();

  public getQueue(guildId: string): GuildQueue | undefined {
    return this.queues.get(guildId);
  }

  public async getOrCreateQueue(options: GuildQueueOptions): Promise<GuildQueue> {
    const existing = this.queues.get(options.guildId);
    if (existing) return existing;

    let connection = getVoiceConnection(options.guildId);

    if (!connection) {
      console.log(`[MusicManager] Создаю новое соединение...`);
      connection = joinVoiceChannel({
        channelId: options.voiceChannel.id,
        guildId: options.guildId,
        adapterCreator: options.voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });
    } else {
      console.log(`[MusicManager] Найдено существующее соединение, статус: ${connection.state.status}`);
      // Если старое соединение сломано — уничтожаем и создаём новое
      if (
        connection.state.status === VoiceConnectionStatus.Destroyed ||
        connection.state.status === VoiceConnectionStatus.Disconnected
      ) {
        console.log(`[MusicManager] Соединение сломано, пересоздаю...`);
        connection.destroy();
        connection = joinVoiceChannel({
          channelId: options.voiceChannel.id,
          guildId: options.guildId,
          adapterCreator: options.voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: true,
        });
      }
    }

    // Логируем все переходы состояний + debug
    connection.on("stateChange", (oldState, newState) => {
      console.log(`[VoiceConnection] ${oldState.status} → ${newState.status}`);
      // Если destroyed — показываем причину
      if (newState.status === VoiceConnectionStatus.Destroyed) {
        console.error(`[VoiceConnection] ❌ Соединение уничтожено`);
      }
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        const reason = (newState as any).reason;
        const closeCode = (newState as any).closeCode;
        console.error(`[VoiceConnection] Disconnected | reason: ${reason} | closeCode: ${closeCode}`);
      }
    });

    connection.on("debug", (msg) => {
      console.log(`[VoiceDebug] ${msg}`);
    });

    console.log(`[MusicManager] Статус сразу после join: ${connection.state.status}`);

    if (connection.state.status !== VoiceConnectionStatus.Ready) {
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
        console.log(`[MusicManager] Соединение готово ✅`);
      } catch {
        connection.destroy();
        throw new Error("Не удалось подключиться к голосовому каналу.");
      }
    } else {
      console.log(`[MusicManager] Соединение уже готово ✅`);
    }

    const queue = new GuildQueue(connection, options);
    connection.subscribe(queue.player);
    console.log(`[MusicManager] Player подписан на соединение ✅`);

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      this.queues.delete(options.guildId);
    });

    this.queues.set(options.guildId, queue);
    return queue;
  }

  public deleteQueue(guildId: string): void {
    this.queues.delete(guildId);
  }
}

export const musicManager = new MusicManager();
