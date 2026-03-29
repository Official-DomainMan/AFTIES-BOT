const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
} = require("discord.js");
const { prisma } = require("../../../core/database");
const { closeTicket } = require("../service");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-close")
    .setDescription("Close the current ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((o) =>
      o
        .setName("reason")
        .setDescription("Reason for closing the ticket")
        .setRequired(false)
        .setMaxLength(300),
    ),

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

      const reason = interaction.options.getString("reason")?.trim() || null;

      return closeTicket(interaction, reason);
    } catch (error) {
      console.error("[ticket-close] error:", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Failed to close this ticket.",
        });
      }

      return interaction.reply({
        content: "❌ Failed to close this ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
