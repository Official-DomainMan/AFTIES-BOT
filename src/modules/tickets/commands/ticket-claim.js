const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
} = require("discord.js");
const { prisma } = require("../../../core/database");
const { claimTicket } = require("../service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-claim")
    .setDescription("Claim the current ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    try {
      if (!interaction.guild || !interaction.channel) {
        return interaction.reply({
          content: "❌ Server only.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const channel = interaction.channel;

      if (channel.type !== ChannelType.GuildText) {
        return interaction.reply({
          content: "❌ This command only works in a text ticket channel.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const ticket = await prisma.ticket.findUnique({
        where: { channelId: channel.id },
      });

      if (
        !ticket ||
        ticket.guildId !== interaction.guild.id ||
        !ticket.isOpen
      ) {
        return interaction.reply({
          content:
            "❌ This command can only be used inside an open ticket channel.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (ticket.claimedById === interaction.user.id) {
        return interaction.reply({
          content: "ℹ️ You already claimed this ticket.",
          flags: MessageFlags.Ephemeral,
        });
      }

      if (ticket.claimedById) {
        return interaction.reply({
          content: `ℹ️ This ticket is already claimed by <@${ticket.claimedById}>.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      return claimTicket(interaction);
    } catch (error) {
      console.error("[ticket-claim] error:", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Failed to claim this ticket.",
        });
      }

      return interaction.reply({
        content: "❌ Failed to claim this ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
