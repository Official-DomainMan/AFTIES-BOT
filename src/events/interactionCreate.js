const { Events } = require("discord.js");
const { handleTicketInteraction } = require("../modules/tickets/interaction");

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    // ============================
    // 🎟️ Ticket components first
    // ============================
    try {
      if (
        (interaction.isButton() || interaction.isModalSubmit()) &&
        typeof interaction.customId === "string" &&
        interaction.customId.startsWith("ticket_")
      ) {
        await handleTicketInteraction(interaction);
        return;
      }
    } catch (err) {
      console.error("[interactionCreate:ticket]", err);
      return;
    }

    // ============================
    // 💬 Slash commands
    // ============================
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.warn(
        `[interactionCreate] No command registered for "${interaction.commandName}"`,
      );
      return;
    }

    try {
      // ❌ DO NOT defer globally
      // ✅ Let each command decide

      await command.execute(interaction);
    } catch (err) {
      console.error(`[interactionCreate:${interaction.commandName}]`, err);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ There was an error running this command.",
          ephemeral: true,
        });
      }
    }
  },
};
