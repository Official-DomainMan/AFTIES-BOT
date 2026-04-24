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
  console.log(`🧾 Collected ${commands.length} commands for global deploy`);

  const rest = new REST({ version: "10" }).setToken(token);

  // Deploy globally to every server the bot is in
  await rest.put(Routes.applicationCommands(clientId), {
    body: commands,
  });

  console.log(`✅ Deployed ${commands.length} global commands`);
})();
