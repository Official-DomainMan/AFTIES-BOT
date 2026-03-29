const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
} = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-add")
    .setDescription("Add a user to the current ticket")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption((o) =>
      o
        .setName("user")
        .setDescription("User to add to this ticket")
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

      if (user.bot && user.id !== interaction.client.user.id) {
        return interaction.reply({
          content: "❌ You can only add human users to tickets.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (!member) {
        return interaction.reply({
          content: "❌ That user is not in this server.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const existingPerms = channel.permissionsFor(user.id);

      if (existingPerms?.has(PermissionFlagsBits.ViewChannel)) {
        return interaction.reply({
          content: `ℹ️ <@${user.id}> already has access to this ticket.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
      });

      await channel.send({
        content: `➕ <@${user.id}> was added to the ticket by <@${interaction.user.id}>.`,
        allowedMentions: {
          users: [user.id, interaction.user.id],
        },
      });

      return interaction.reply({
        content: `✅ Added <@${user.id}> to this ticket.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("[ticket-add] error:", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Failed to add that user to the ticket.",
        });
      }

      return interaction.reply({
        content: "❌ Failed to add that user to the ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
