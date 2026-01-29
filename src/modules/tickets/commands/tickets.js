const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { ticketPanelRow } = require("../components");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tickets")
    .setDescription("Post the support ticket panel in this channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({ content: "Server only.", flags: 64 });
      }

      const embed = new EmbedBuilder()
        .setTitle("🎟️ Support Tickets")
        .setDescription(
          "Click **Open Ticket** to create a private support channel.\n\n" +
            "• One open ticket per user\n" +
            "• Staff can **Claim** tickets\n" +
            "• Tickets can be **Closed** with a reason\n" +
            "• Optional **Transcripts** can be logged",
        )
        .setFooter({ text: `Serving ${interaction.guild.name}` })
        .setTimestamp();

      await interaction.channel.send({
        embeds: [embed],
        components: [ticketPanelRow()],
      });

      return interaction.reply({
        content: "✅ Ticket panel posted.",
        flags: 64,
      });
    } catch (err) {
      console.error("[tickets] panel error:", err);
      if (!interaction.replied) {
        await interaction.reply({
          content: "❌ Failed to post ticket panel.",
          flags: 64,
        });
      }
    }
  },
};
