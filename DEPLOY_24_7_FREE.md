# Free 24/7 Hosting

If you want the bot to stay online even when your own PC is off, the most realistic free option is an Oracle Cloud Always Free VM.

Why this route:

- Render free services sleep after inactivity.
- Koyeb free services can scale to zero.
- Railway is not truly always-on for free.
- A small VM keeps a Discord bot connected all the time.

For this repository, prefer an x86 Ubuntu VM (`VM.Standard.E2.1.Micro`) instead of ARM. This project uses native audio dependencies, and x86 is usually the least painful path.

## 1. Create the VM

Create an Oracle Cloud Always Free Ubuntu instance in your home region.

Recommended shape:

- `VM.Standard.E2.1.Micro`
- Ubuntu 22.04 or 24.04

## 2. Install Node.js and build tools

Run these commands on the server:

```bash
sudo apt update
sudo apt install -y curl git build-essential python3 make g++
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 3. Upload the bot

```bash
git clone https://github.com/AliaidarBopov/Discord-music-bot.git
cd Discord-music-bot
npm ci
```

If you are deploying your local version instead of GitHub, copy your current project files to the VM and then run:

```bash
npm ci
```

## 4. Configure environment variables

Create `.env` in the project root:

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
```

Optional:

- `GUILD_ID=your_test_server_id` if you want `npm run deploy` to register commands instantly in one test server.
- Leave `GUILD_ID` unset for global slash commands on every server where the bot is invited.

## 5. Build and register commands

```bash
npm run build
npm run deploy
```

If you deployed globally, Discord can take some time to show updated slash commands everywhere.

## 6. Run the bot as a system service

Copy the included service template:

```bash
sudo cp deploy/discord-music-bot.service /etc/systemd/system/discord-music-bot.service
```

Edit it and replace:

- `YOUR_LINUX_USER`
- `YOUR_PROJECT_PATH`

Then enable the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now discord-music-bot
sudo systemctl status discord-music-bot
```

Logs:

```bash
journalctl -u discord-music-bot -f
```

## 7. Invite the bot to other servers

In Discord Developer Portal:

- Go to `OAuth2 -> URL Generator`
- Scopes: `bot`, `applications.commands`
- Permissions: `View Channels`, `Send Messages`, `Connect`, `Speak`, `Use Slash Commands`

After that, anyone with permission to add the bot can invite it to a server and use the slash commands there.

## Notes

- This project already supports global slash-command registration when `GUILD_ID` is not set.
- Free Oracle VMs can be reclaimed if they stay idle for too long, so keep the bot actually running.
- If Oracle Cloud account creation is not convenient, the next best free option is to run the bot on your own always-on device like an old laptop, mini PC, or Raspberry Pi.
