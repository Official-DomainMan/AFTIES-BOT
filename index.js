const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { loadEvents } = require("./src/handlers/eventLoader");
const { initMusic } = require("./src/modules/music/player");

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN missing in .env");
  process.exit(1);
}

// Create the Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();

/**
 * Recursively collect all .js files under a directory
 */
function getAllJsFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllJsFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(full);
    }
  }

  return out;
}

/**
 * Load all commands from any ".../commands/..." directory
 */
function loadCommandsRecursive(rootDir) {
  const allFiles = getAllJsFiles(rootDir);

  // Only treat files inside a "commands" folder as slash commands
  const commandFiles = allFiles.filter((p) =>
    p.split(path.sep).includes("commands")
  );

  console.log(`📂 Command files found: ${commandFiles.length}`);
  let loaded = 0;

  for (const filePath of commandFiles) {
    try {
      const command = require(filePath);

      if (!command?.data?.name || typeof command.execute !== "function") {
        console.log(`⚠️ Skipped (invalid command): ${filePath}`);
        continue;
      }

      client.commands.set(command.data.name, command);
      loaded++;
      console.log(`✅ ${command.data.name} ← ${filePath}`);
    } catch (err) {
      console.error(`❌ Failed to load command file: ${filePath}`);
      console.error(err);
    }
  }

  console.log(`📦 Loaded ${loaded} commands`);
}

// Load all commands from src/
loadCommandsRecursive(path.join(__dirname, "src"));

// Initialize the music system (DisTube, Spotify/Soundcloud, etc.)
initMusic(client);

// Load events from src/events via your event loader
loadEvents(client, path.join(__dirname, "src/events"));

// Log in
client.login(process.env.DISCORD_TOKEN);
