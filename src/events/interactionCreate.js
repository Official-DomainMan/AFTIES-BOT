// src/events/interactionCreate.js
const { Events } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.warn(
        `[interactionCreate] No command registered for "${interaction.commandName}"`
      );
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(
        `[${command.data?.name || interaction.commandName}] error:`,
        error
      );

      // Only try to send a fallback error if nothing was sent yet
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: "❌ Error running command",
            ephemeral: true,
          });
        } catch (err) {
          console.error("Failed to send error response:", err);
        }
      } else {
        // We've already acknowledged the interaction; log and move on.
        console.warn(
          `[${
            command.data?.name || interaction.commandName
          }] interaction already acknowledged; skipped error reply.`
        );
      }
    }
  },
};
