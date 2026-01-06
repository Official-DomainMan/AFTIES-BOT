const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { Collection } = require("discord.js");
const { createClient } = require("./src/core/client");
const { loadEvents } = require("./src/handlers/eventLoader");

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ DISCORD_TOKEN missing in .env");
  process.exit(1);
}

const client = createClient();

// ✅ FIX: ensure commands collection exists
client.commands = new Collection();

// ===============================
// RECURSIVE COMMAND LOADER (DEBUG)
// ===============================
function getAllJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

function loadCommandsRecursive() {
  const srcPath = path.join(__dirname, "src");
  const allFiles = getAllJsFiles(srcPath);

  const commandFiles = allFiles.filter((p) =>
    p.split(path.sep).includes("commands")
  );

  console.log("📂 Command files found:", commandFiles.length);

  let count = 0;

  for (const filePath of commandFiles) {
    const command = require(filePath);

    if (!command?.data?.name || typeof command.execute !== "function") {
      console.log("⚠️ Skipped invalid command:", filePath);
      continue;
    }

    client.commands.set(command.data.name, command);
    count++;

    console.log("✅", command.data.name, "←", filePath);
  }

  console.log(`📦 Loaded ${count} commands`);
}

loadCommandsRecursive();

// Load events
loadEvents(client, path.join(__dirname, "src/events"));

// Login
client.login(process.env.DISCORD_TOKEN);
