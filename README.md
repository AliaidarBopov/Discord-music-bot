# Discord Music Bot

A fully-featured Discord music bot built with TypeScript, discord.js v14, and yt-dlp.

## Features

- Play music from YouTube by name or URL
- Queue system with multiple tracks
- Skip, pause, resume controls
- Clean audio pipeline via yt-dlp + ffmpeg
- Slash commands (`/play`, `/skip`, etc.)

## Tech Stack

- **Language:** TypeScript
- **Discord:** discord.js v14
- **Voice:** @discordjs/voice v0.19
- **Audio:** yt-dlp + ffmpeg-static
- **Search:** play-dl

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/AliaidarBopov/Discord-music-bot.git
cd Discord-music-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file in the root directory:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
```

Optional for instant testing in one server:

```env
GUILD_ID=your_server_id
```

Get your token and client ID from [Discord Developer Portal](https://discord.com/developers/applications).

### 4. Enable required intents

In the Developer Portal -> Bot, enable:

- Server Members Intent
- Message Content Intent

### 5. Register slash commands

```bash
npm run deploy
```

If `GUILD_ID` is set, commands are registered only for that server and appear almost instantly.
If `GUILD_ID` is not set, commands are registered globally for every server where the bot is invited.

### 6. Start the bot

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Commands

| Command | Description |
|---|---|
| `/play <query>` | Play a track by name or YouTube URL |
| `/skip` | Skip the current track |
| `/stop` | Stop playback and leave the channel |
| `/pause` | Pause the current track |
| `/resume` | Resume playback |
| `/queue` | Show the current queue |

## Project Structure

```text
src/
|-- index.ts                  # Entry point
|-- deploy-commands.ts        # Slash command registration
|-- types/
|   `-- music.ts              # Track and Queue interfaces
|-- music/
|   |-- MusicManager.ts       # Singleton queue manager
|   `-- GuildQueue.ts         # Per-server queue and player
`-- commands/
    |-- CommandHandler.ts     # Command router
    |-- play.ts
    |-- skip.ts
    |-- stop.ts
    |-- pause.ts
    |-- resume.ts
    `-- queue.ts
```

## Hosting

For a bot that should stay online even when your PC is off, see [DEPLOY_24_7_FREE.md](DEPLOY_24_7_FREE.md).

Short version:

- Oracle Cloud Always Free VM is the most realistic free 24/7 option.
- Railway, Render, and Koyeb are convenient, but their free tiers are not a reliable true always-on setup for a Discord music bot.

Set environment variables on your hosting platform instead of using a `.env` file.

## License

MIT
