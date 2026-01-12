require("dotenv").config();
const { REST, Routes } = require("discord.js");

(async () => {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.CLIENT_ID;

  if (!token) return console.error("❌ Missing DISCORD_TOKEN");
  if (!clientId) return console.error("❌ Missing CLIENT_ID");

  try {
    const rest = new REST({ version: "10" }).setToken(token);

    await rest.put(Routes.applicationCommands(clientId), { body: [] });

    console.log("🧹 Cleared ALL GLOBAL slash commands.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to clear global commands:", err);
    process.exit(1);
  }
})();
