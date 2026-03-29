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

      if (user.bot && user.id !== interaction.client.user.id) {
        return respond(interaction, {
          content: "❌ You can only add human users to tickets.",
        });
      }

      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (!member) {
        return respond(interaction, {
          content: "❌ That user is not in this server.",
        });
      }

      const existingPerms = channel.permissionsFor(user.id);

      if (existingPerms?.has(PermissionFlagsBits.ViewChannel)) {
        return respond(interaction, {
          content: `ℹ️ <@${user.id}> already has access to this ticket.`,
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

      return respond(interaction, {
        content: `✅ Added <@${user.id}> to this ticket.`,
      });
    } catch (error) {
      console.error("[ticket-add] error:", error);

      return respond(interaction, {
        content: "❌ Failed to add that user to the ticket.",
      });
    }
  },
};
