import { VoiceChannel, TextChannel } from "discord.js";

export interface Track {
  title: string;
  url: string;
  duration: string;
  requestedBy: string;
  artist?: string;
  thumbnailUrl?: string;
}

/** off — без повтора, track — повтор текущего трека, queue — повтор всей очереди */
export type LoopMode = "off" | "track" | "queue";

export interface GuildQueueOptions {
  guildId: string;
  voiceChannel: VoiceChannel;
  textChannel: TextChannel;
}
