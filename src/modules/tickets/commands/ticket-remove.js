const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
} = require("discord.js");
const { prisma } = require("../../../core/database");

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

      const user = interaction.options.getUser("user", true);

      if (user.id === ticket.ownerId) {
        return interaction.reply({
          content:
            "❌ You cannot remove the ticket owner from their own ticket.",
          flags: MessageFlags.Ephemeral,
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
          return interaction.reply({
            content: "❌ You cannot remove the server owner from the ticket.",
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      const existingOverwrite = channel.permissionOverwrites.cache.get(user.id);
      const hasView = channel
        .permissionsFor(user.id)
        ?.has(PermissionFlagsBits.ViewChannel);

      if (!existingOverwrite && !hasView) {
        return interaction.reply({
          content: `ℹ️ <@${user.id}> does not appear to have direct access to this ticket.`,
          flags: MessageFlags.Ephemeral,
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

      return interaction.reply({
        content: `✅ Removed <@${user.id}> from this ticket.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("[ticket-remove] error:", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Failed to remove that user from the ticket.",
        });
      }

      return interaction.reply({
        content: "❌ Failed to remove that user from the ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
