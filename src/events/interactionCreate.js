const { Events } = require("discord.js");
const { handleTicketInteraction } = require("../modules/tickets/interaction");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // ============================
    // 🎟️ Ticket components first
    // ============================
    try {
      // Buttons + Modals for tickets
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
      // Don't reply here; ticket handler manages replies
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
      // Do NOT reply or defer here.
      // Each command file is responsible for replying/defer/editing.
      await command.execute(interaction);
    } catch (err) {
      console.error(`[interactionCreate:${interaction.commandName}]`, err);
      // NO reply here. Just log.
    }
  },
};
