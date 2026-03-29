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

function sanitizeTicketName(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9- ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-rename")
    .setDescription("Rename the current ticket channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((o) =>
      o
        .setName("name")
        .setDescription("New ticket name")
        .setRequired(true)
        .setMaxLength(90),
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

      const rawName = interaction.options.getString("name", true);
      const safeName = sanitizeTicketName(rawName);

      if (!safeName || safeName.length < 3) {
        return respond(interaction, {
          content:
            "❌ That name is too short or contains no usable characters. Use at least 3 letters or numbers.",
        });
      }

      const finalName = safeName.startsWith("ticket-")
        ? safeName
        : `ticket-${safeName}`;

      if (channel.name === finalName) {
        return respond(interaction, {
          content: `ℹ️ This ticket is already named \`${finalName}\`.`,
        });
      }

      await channel.setName(finalName, `Renamed by ${interaction.user.tag}`);

      await channel.send({
        content: `✏️ Ticket renamed to \`${finalName}\` by <@${interaction.user.id}>.`,
        allowedMentions: {
          users: [interaction.user.id],
        },
      });

      return respond(interaction, {
        content: `✅ Ticket renamed to \`${finalName}\`.`,
      });
    } catch (error) {
      console.error("[ticket-rename] error:", error);

      return respond(interaction, {
        content: "❌ Failed to rename this ticket.",
      });
    }
  },
};
