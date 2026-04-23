import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  StreamType,
  VoiceConnection,
  createAudioPlayer,
  createAudioResource,
  entersState,
  VoiceConnectionStatus,
  VoiceConnectionDisconnectReason,
} from "@discordjs/voice";
import { EmbedBuilder, Message, TextChannel, VoiceChannel } from "discord.js";
import { Track } from "../types/music";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import path from "path";
import fs from "fs";
import ffmpegStatic from "ffmpeg-static";
import { createNowPlayingControlsRow } from "../commands/musicControls";

export class GuildQueue {
  public readonly guildId: string;
  public readonly voiceChannel: VoiceChannel;
  public readonly textChannel: TextChannel;

  public tracks: Track[] = [];
  public currentTrack: Track | null = null;
  public isPlaying = false;
  public isPaused = false;

  public readonly player: AudioPlayer;
  public connection: VoiceConnection;

  private _isTransitioning = false;
  private _ytDlpProcess: ChildProcessWithoutNullStreams | null = null;
  private _ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
  private _isDestroyingConnection = false;
  private _nowPlayingMessage: Message | null = null;

  constructor(
    connection: VoiceConnection,
    options: { guildId: string; voiceChannel: VoiceChannel; textChannel: TextChannel }
  ) {
    this.guildId = options.guildId;
    this.voiceChannel = options.voiceChannel;
    this.textChannel = options.textChannel;
    this.connection = connection;
    this.player = createAudioPlayer();

    this._bindPlayerEvents();
    this._bindConnectionEvents();
  }

  public enqueue(track: Track): void {
    this.tracks.push(track);
  }

  public async playNext(): Promise<void> {
    if (this._isTransitioning) return;

    if (this.tracks.length === 0) {
      await this._clearNowPlayingControls();
      this._resetPlaybackState();
      return;
    }

    this._isTransitioning = true;
    this.currentTrack = this.tracks.shift()!;
    this.isPlaying = true;
    this.isPaused = false;

    try {
      this._cleanupPlaybackPipeline();
      console.log(`[GuildQueue] Getting stream for: ${this.currentTrack.url}`);

      const ytDlpPath = path.join(
        __dirname,
        "..",
        "..",
        "node_modules",
        "youtube-dl-exec",
        "bin",
        process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp"
      );

      const ytDlpArgs: string[] = [
        "-f",
        // Prefer m4a (often more stable than webm when piping)
        "bestaudio[ext=m4a]/bestaudio/best",
        "-o",
        "-",
        "--quiet",
        "--no-warnings",
        "--no-playlist",
        // Stability tweaks
        "--retries",
        "3",
        "--fragment-retries",
        "3",
        "--socket-timeout",
        "15",
        // Keep it conservative when streaming to stdout
        "--concurrent-fragments",
        "1",
      ];

      const cookiesPath = (process.env.YTDLP_COOKIES ?? "").trim();
      if (cookiesPath) {
        if (fs.existsSync(cookiesPath)) {
          ytDlpArgs.push("--cookies", cookiesPath);
        } else {
          console.warn(`[GuildQueue] YTDLP_COOKIES file not found: ${cookiesPath}`);
        }
      }

      ytDlpArgs.push(this.currentTrack.url);

      const ytDlpProcess = spawn(ytDlpPath, ytDlpArgs, {
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      }) as ChildProcessWithoutNullStreams;
      this._ytDlpProcess = ytDlpProcess;

      let ytDlpStderr = "";
      ytDlpProcess.stderr.on("data", (data) => {
        const chunk = data.toString();
        ytDlpStderr += chunk;
        // keep it bounded
        if (ytDlpStderr.length > 20_000) ytDlpStderr = ytDlpStderr.slice(-20_000);
        console.error("[yt-dlp error]", chunk);
      });

      ytDlpProcess.on("error", (error) => console.error("[yt-dlp spawn error]", error));

      // Start ffmpeg only after yt-dlp actually produced data.
      // This prevents ffmpeg from trying to decode an empty/failed yt-dlp output (pipe:0 invalid data).
      const firstStdoutChunk: Buffer = await new Promise((resolve, reject) => {
        const onData = (chunk: Buffer) => {
          cleanup();
          resolve(chunk);
        };

        const onClose = (code: number | null) => {
          cleanup();
          if (code === 0) {
            reject(new Error("yt-dlp завершился без вывода аудио"));
            return;
          }

          const msg = ytDlpStderr.trim() || `yt-dlp завершился с кодом ${code}`;
          reject(new Error(msg));
        };

        const onError = (err: unknown) => {
          cleanup();
          reject(err);
        };

        const cleanup = () => {
          ytDlpProcess.stdout.off("data", onData);
          ytDlpProcess.off("close", onClose);
          ytDlpProcess.off("error", onError);
        };

        ytDlpProcess.stdout.once("data", onData);
        ytDlpProcess.once("close", onClose);
        ytDlpProcess.once("error", onError);
      });

      const ffmpegProcess = spawn(
        ffmpegStatic!,
        [
        "-i",
        "pipe:0",
        "-vn",
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-acodec",
        "pcm_s16le",
        "-loglevel",
        "error",
        "-hide_banner",
        "-nostdin",
        "pipe:1",
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        }
      ) as ChildProcessWithoutNullStreams;

      this._ffmpegProcess = ffmpegProcess;

      ffmpegProcess.stdin.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code !== "EPIPE") {
          console.error("[ffmpeg stdin error]", error);
        }
      });

      ffmpegProcess.stderr.on("data", (data) => console.error("[ffmpeg error]", data.toString()));
      ffmpegProcess.on("error", (error) => console.error("[ffmpeg spawn error]", error));

      // Feed the first chunk we already consumed, then pipe the rest.
      ffmpegProcess.stdin.write(firstStdoutChunk);
      ytDlpProcess.stdout.pipe(ffmpegProcess.stdin);

      const resource: AudioResource = createAudioResource(ffmpegProcess.stdout, { inputType: StreamType.Raw });

      this.player.play(resource);
      console.log("[GuildQueue] player.play() called, waiting for Playing...");

      await entersState(this.player, AudioPlayerStatus.Playing, 15_000);
      console.log("[GuildQueue] Player entered Playing state.");

      const nowPlayingEmbed = new EmbedBuilder()
        .setColor(0x1f9d8b)
        .setTitle("Сейчас играет")
        .setDescription(`[${this.currentTrack.title}](${this.currentTrack.url})`)
        .addFields(
          { name: "Исполнитель", value: this.currentTrack.artist ?? "Неизвестно", inline: true },
          { name: "Длительность", value: this.currentTrack.duration, inline: true },
          { name: "Запросил", value: this.currentTrack.requestedBy, inline: true },
          { name: "В очереди", value: `${this.tracks.length}`, inline: true }
        )
        .setFooter({ text: "Blya igraet ne vyebyvaisya" })
        .setTimestamp();

      if (this.currentTrack.thumbnailUrl) {
        nowPlayingEmbed.setThumbnail(this.currentTrack.thumbnailUrl);
      }

      await this._clearNowPlayingControls();

      this._nowPlayingMessage = await this.textChannel.send({
        embeds: [nowPlayingEmbed],
        components: [createNowPlayingControlsRow(this.isPaused)],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[GuildQueue] Playback error:", error);

      const looksLikeAgeRestriction = /sign in to confirm your age|confirm your age|inappropriate for some users/i.test(
        message
      );

      await this.textChannel
        .send(
          looksLikeAgeRestriction
            ? "❌ YouTube просит подтверждение возраста. Добавь cookies для `yt-dlp` (переменная `YTDLP_COOKIES` в `.env`) и попробуй снова."
            : "❌ Не удалось воспроизвести трек, пропускаю..."
        )
        .catch(() => {});
      this._cleanupPlaybackPipeline();
      this._isTransitioning = false;
      await this.playNext();
      return;
    }

    this._isTransitioning = false;
  }

  public skip(): boolean {
    if (!this.isPlaying) return false;
    this._cleanupPlaybackPipeline();
    this.player.stop(true);
    return true;
  }

  public stop(): void {
    this.tracks = [];
    this._resetPlaybackState();
    void this._clearNowPlayingControls();
    this._cleanupPlaybackPipeline();
    this.player.stop(true);

    if (!this._isDestroyingConnection && this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this._isDestroyingConnection = true;
      this.connection.destroy();
      this._isDestroyingConnection = false;
    }
  }

  public restartCurrent(): boolean {
    if (!this.currentTrack || !this.isPlaying) return false;
    this.tracks.unshift(this.currentTrack);
    this._cleanupPlaybackPipeline();
    this.player.stop(true);
    return true;
  }

  public pause(): boolean {
    if (!this.isPlaying || this.isPaused) return false;
    this.player.pause();
    this.isPaused = true;
    return true;
  }

  public resume(): boolean {
    if (!this.isPaused) return false;
    this.player.unpause();
    this.isPaused = false;
    return true;
  }

  private _bindPlayerEvents(): void {
    this.player.on(AudioPlayerStatus.Idle, (oldState) => {
      if (
        oldState.status === AudioPlayerStatus.Playing ||
        oldState.status === AudioPlayerStatus.Buffering
      ) {
        this.playNext().catch(console.error);
      }
    });

    this.player.on("error", (error) => {
      console.error("[AudioPlayer] Error:", error.message);
    });
  }

  private _bindConnectionEvents(): void {
    this.connection.on(VoiceConnectionStatus.Disconnected, async (_, newState) => {
      const botVoiceChannelId = this.voiceChannel.guild.members.me?.voice.channelId ?? null;

      if (!botVoiceChannelId) {
        await this._handleVoiceChannelLeave();
        return;
      }

      if (
        newState.reason === VoiceConnectionDisconnectReason.WebSocketClose &&
        newState.closeCode === 4014
      ) {
        try {
          await entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000);
        } catch {
          await this._handleVoiceChannelLeave();
        }
      } else if (this.connection.rejoinAttempts < 5) {
        this.connection.rejoin();
      } else {
        await this._handleVoiceChannelLeave();
      }
    });

    this.connection.on(VoiceConnectionStatus.Destroyed, () => {
      this.tracks = [];
      this._resetPlaybackState();
      void this._clearNowPlayingControls();
      this._cleanupPlaybackPipeline();
      this.player.stop();
    });
  }

  private async _handleVoiceChannelLeave(): Promise<void> {
    this.tracks = [];
    this._resetPlaybackState();
    await this._clearNowPlayingControls();
    this._cleanupPlaybackPipeline();

    if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      this.connection.destroy();
    }
  }

  private _cleanupPlaybackPipeline(): void {
    const ytDlpProcess = this._ytDlpProcess;
    const ffmpegProcess = this._ffmpegProcess;

    if (!ytDlpProcess && !ffmpegProcess) return;

    this._ytDlpProcess = null;
    this._ffmpegProcess = null;

    try {
      ytDlpProcess?.stdout.unpipe(ffmpegProcess?.stdin);
    } catch {
      // no-op
    }

    try {
      ffmpegProcess?.stdin.end();
    } catch {
      // no-op
    }

    try {
      if (ytDlpProcess && !ytDlpProcess.killed) ytDlpProcess.kill();
    } catch {
      // no-op
    }

    try {
      if (ffmpegProcess && !ffmpegProcess.killed) ffmpegProcess.kill();
    } catch {
      // no-op
    }
  }

  private async _clearNowPlayingControls(): Promise<void> {
    const nowPlayingMessage = this._nowPlayingMessage;
    if (!nowPlayingMessage) return;

    try {
      await nowPlayingMessage.edit({ components: [] });
      this._nowPlayingMessage = null;
    } catch (error) {
      try {
        const freshMessage = await this.textChannel.messages.fetch(nowPlayingMessage.id);
        await freshMessage.edit({ components: [] });
        this._nowPlayingMessage = null;
      } catch (fetchError) {
        console.error("[GuildQueue] Failed to clear now playing controls:", error);
        console.error("[GuildQueue] Retried via fetch, but it also failed:", fetchError);
      }
    }
  }

  private _resetPlaybackState(): void {
    this.currentTrack = null;
    this.isPlaying = false;
    this.isPaused = false;
  }
}
