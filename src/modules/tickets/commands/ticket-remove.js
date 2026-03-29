const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const { prisma } = require("../../../core/database");

function respond(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-remove")
    .setDescription("Remove a user from the current ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("User to remove from this ticket")
        .setRequired(true),
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

      const user = interaction.options.getUser("user", true);

      if (user.id === ticket.ownerId) {
        return respond(interaction, {
          content:
            "❌ You cannot remove the ticket owner from their own ticket.",
        });
      }

      const settings = await prisma.ticketSettings.findUnique({
        where: { guildId: interaction.guild.id },
      });

      if (settings?.supportRoleId) {
        const supportRole = interaction.guild.roles.cache.get(
          settings.supportRoleId,
        );
        if (supportRole && user.id === interaction.guild.ownerId) {
          return respond(interaction, {
            content: "❌ You cannot remove the server owner from the ticket.",
          });
        }
      }

      const existingOverwrite = channel.permissionOverwrites.cache.get(user.id);
      const hasView = channel
        .permissionsFor(user.id)
        ?.has(PermissionFlagsBits.ViewChannel);

      if (!existingOverwrite && !hasView) {
        return respond(interaction, {
          content: `ℹ️ <@${user.id}> does not appear to have direct access to this ticket.`,
        });
      }

      await channel.permissionOverwrites.delete(user.id).catch(async () => {
        await channel.permissionOverwrites.edit(user.id, {
          ViewChannel: false,
        });
      });

      await channel.send({
        content: `➖ <@${user.id}> was removed from the ticket by <@${interaction.user.id}>.`,
        allowedMentions: {
          users: [user.id, interaction.user.id],
        },
      });

      return respond(interaction, {
        content: `✅ Removed <@${user.id}> from this ticket.`,
      });
    } catch (error) {
      console.error("[ticket-remove] error:", error);

      return respond(interaction, {
        content: "❌ Failed to remove that user from the ticket.",
      });
    }
  },
};
