const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const { prisma } = require("../../../core/database");
const { closeTicket } = require("../service");

function respond(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

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
        return respond(interaction, {
          content: "❌ Server only.",
        });
      }

      const channel = interaction.channel;

      if (channel.type !== ChannelType.GuildText) {
        return respond(interaction, {
          content: "❌ This command only works in a text ticket channel.",
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
        return respond(interaction, {
          content:
            "❌ This command can only be used inside an open ticket channel.",
        });
      }

      const reason = interaction.options.getString("reason")?.trim() || null;

      return closeTicket(interaction, reason);
    } catch (error) {
      console.error("[ticket-close] error:", error);

      return respond(interaction, {
        content: "❌ Failed to close this ticket.",
      });
    }
  },
};
