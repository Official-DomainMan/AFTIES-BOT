const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-setup-old")
    .setDescription("Post the support ticket panel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    const panelEmbed = new EmbedBuilder()
      .setTitle("🎟️ Support Center")
      .setDescription(
        "Need help? Click the button below to open a support ticket. Our staff will assist you!",
      )
      .setColor(0x00aeff);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("ticket_create")
        .setLabel("🎫 Create Ticket")
        .setStyle(ButtonStyle.Primary),
    );

    await interaction.reply({
      embeds: [panelEmbed],
      components: [row],
    });
  },
};
