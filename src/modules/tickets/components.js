const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

function ticketPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_create")
      .setLabel("Open Ticket")
      .setStyle(ButtonStyle.Primary),
  );
}

function ticketControlsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket_claim")
      .setLabel("Claim")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("ticket_transcript")
      .setLabel("Transcript")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId("ticket_close")
      .setLabel("Close")
      .setStyle(ButtonStyle.Danger),
  );
}

module.exports = {
  ticketPanelRow,
  ticketControlsRow,
};
