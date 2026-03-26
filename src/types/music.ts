import { VoiceChannel, TextChannel } from "discord.js";

export interface Track {
  title: string;
  url: string;
  duration: string;
  requestedBy: string;
}

export interface GuildQueueOptions {
  guildId: string;
  voiceChannel: VoiceChannel;
  textChannel: TextChannel;
}
