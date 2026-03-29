const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const {
  createTicket,
  claimTicket,
  transcriptTicket,
  closeTicket,
  EPHEMERAL_FLAGS,
} = require("./service");

async function handleTicketInteraction(interaction) {
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id === "ticket_create") {
      return createTicket(interaction);
    }

    if (id === "ticket_claim") {
      return claimTicket(interaction);
    }

    if (id === "ticket_transcript") {
      return transcriptTicket(interaction);
    }

    if (id === "ticket_close") {
      const modal = new ModalBuilder()
        .setCustomId("ticket_close_modal")
        .setTitle("Close Ticket");

      const reason = new TextInputBuilder()
        .setCustomId("reason")
        .setLabel("Reason (optional)")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false)
        .setMaxLength(300)
        .setPlaceholder("Example: resolved, duplicate, user inactive, etc.");

      modal.addComponents(new ActionRowBuilder().addComponents(reason));
      await interaction.showModal(modal);
      return;
    }

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        content: "Unknown ticket action.",
      });
    }

    return interaction.reply({
      content: "Unknown ticket action.",
      flags: EPHEMERAL_FLAGS,
    });
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "ticket_close_modal") {
      const reason =
        interaction.fields.getTextInputValue("reason")?.trim() || null;
      return closeTicket(interaction, reason);
    }
  }
}

module.exports = { handleTicketInteraction };
