const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const { prisma } = require("../../../core/database");
const { claimTicket } = require("../service");

function respond(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-claim")
    .setDescription("Claim the current ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

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

      if (ticket.claimedById === interaction.user.id) {
        return respond(interaction, {
          content: "ℹ️ You already claimed this ticket.",
        });
      }

      if (ticket.claimedById) {
        return respond(interaction, {
          content: `ℹ️ This ticket is already claimed by <@${ticket.claimedById}>.`,
        });
      }

      return claimTicket(interaction);
    } catch (error) {
      console.error("[ticket-claim] error:", error);

      return respond(interaction, {
        content: "❌ Failed to claim this ticket.",
      });
    }
  },
};
