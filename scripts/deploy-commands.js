require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { REST, Routes } = require("discord.js");

function getAllJsFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) getAllJsFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function collectCommands(srcRoot) {
  const allFiles = getAllJsFiles(srcRoot);

  // ✅ ONLY load files inside a ".../commands/..." folder
  const commandFiles = allFiles.filter((p) =>
    p.split(path.sep).includes("commands")
  );

  const commands = [];
  for (const filePath of commandFiles) {
    try {
      const cmd = require(filePath);
      if (cmd?.data?.toJSON) commands.push(cmd.data.toJSON());
      else console.log(`⚠️ Skipped (no data.toJSON): ${filePath}`);
    } catch (e) {
      console.log(`❌ Failed requiring: ${filePath}`);
      throw e;
    }
  }

  return commands;
}

(async () => {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token) throw new Error("Missing DISCORD_TOKEN in .env");
  if (!clientId) throw new Error("Missing CLIENT_ID in .env");
  if (!guildId) throw new Error("Missing GUILD_ID in .env");

  const srcRoot = path.join(__dirname, "..", "src");
  const commands = collectCommands(srcRoot);

  const rest = new REST({ version: "10" }).setToken(token);

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });

  console.log(`✅ Deployed ${commands.length} guild slash commands`);
})();
