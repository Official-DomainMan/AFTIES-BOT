// scripts/deploy-commands.js
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const { REST, Routes } = require("discord.js");

function collectCommands(dir, out = []) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) {
      collectCommands(full, out);
    } else if (file.endsWith(".js")) {
      const cmd = require(full);
      if (cmd?.data?.toJSON) {
        out.push(cmd.data.toJSON());
      }
    }
  }
  return out;
}

(async () => {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token) throw new Error("Missing DISCORD_TOKEN in .env");
  if (!clientId) throw new Error("Missing CLIENT_ID in .env");

  const commands = collectCommands(path.join(__dirname, "..", "src"));
  console.log(`🧾 Collected ${commands.length} commands for deploy`);

  const rest = new REST({ version: "10" }).setToken(token);

  // 1) Global commands (all servers the bot is in)
  try {
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });
    console.log(`✅ Deployed ${commands.length} GLOBAL commands`);
  } catch (err) {
    console.error("❌ Failed to deploy GLOBAL commands:", err);
  }

  // 2) Optional: dev guild override (the one in your .env)
  const guildId = process.env.GUILD_ID;
  if (guildId) {
    try {
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log(
        `✅ Deployed ${commands.length} GUILD commands to ${guildId}`
      );
    } catch (err) {
      console.error("❌ Failed to deploy GUILD commands:", err);
    }
  }
})();
