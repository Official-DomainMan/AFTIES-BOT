// src/events/interactionCreate.js
const { Events } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`${interaction.commandName} error:`, error);

      // Try to send an error response, but don't let failures crash the bot
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: "❌ Error running command",
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: "❌ Error running command",
            ephemeral: true,
          });
        }
      } catch (replyErr) {
        // This is where 10062 ("Unknown interaction") can happen;
        // just log it and swallow so the client doesn't crash.
        console.error("Failed to send error response:", replyErr);
      }
    }
  },
};
