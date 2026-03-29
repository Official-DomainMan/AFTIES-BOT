const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
} = require("discord.js");
const { prisma } = require("../../../core/database");

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

      const rawName = interaction.options.getString("name", true);
      const safeName = sanitizeTicketName(rawName);

      if (!safeName || safeName.length < 3) {
        return interaction.reply({
          content:
            "❌ That name is too short or contains no usable characters. Use at least 3 letters or numbers.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const finalName = safeName.startsWith("ticket-")
        ? safeName
        : `ticket-${safeName}`;

      if (channel.name === finalName) {
        return interaction.reply({
          content: `ℹ️ This ticket is already named \`${finalName}\`.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await channel.setName(finalName, `Renamed by ${interaction.user.tag}`);

      await channel.send({
        content: `✏️ Ticket renamed to \`${finalName}\` by <@${interaction.user.id}>.`,
        allowedMentions: {
          users: [interaction.user.id],
        },
      });

      return interaction.reply({
        content: `✅ Ticket renamed to \`${finalName}\`.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("[ticket-rename] error:", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Failed to rename this ticket.",
        });
      }

      return interaction.reply({
        content: "❌ Failed to rename this ticket.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
