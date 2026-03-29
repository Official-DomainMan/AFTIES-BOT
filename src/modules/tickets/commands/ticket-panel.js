const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

function respond(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-panel")
    .setDescription("Post the ticket creation panel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o
        .setName("channel")
        .setDescription(
          "Channel to post the panel in (defaults to current channel)",
        )
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    )
    .addStringOption((o) =>
      o
        .setName("title")
        .setDescription("Custom panel title")
        .setMaxLength(256)
        .setRequired(false),
    )
    .addStringOption((o) =>
      o
        .setName("description")
        .setDescription("Custom panel description")
        .setMaxLength(4000)
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return respond(interaction, {
          content: "❌ Server only.",
        });
      }

      const targetChannel =
        interaction.options.getChannel("channel") || interaction.channel;
      const title =
        interaction.options.getString("title") || "🎫 Open a Support Ticket";
      const description =
        interaction.options.getString("description") ||
        [
          "Need help from staff?",
          "",
          "Press the button below to open a private support ticket.",
          "",
          "**Before opening a ticket:**",
          "• Explain your issue clearly",
          "• Include relevant details/screenshots",
          "• Be patient while staff responds",
        ].join("\n");

      if (!targetChannel || !targetChannel.isTextBased()) {
        return respond(interaction, {
          content: "❌ I can only post the ticket panel in a text channel.",
        });
      }

      const botMember =
        interaction.guild.members.me ??
        (await interaction.guild.members.fetchMe().catch(() => null));

      if (!botMember) {
        return respond(interaction, {
          content: "❌ I couldn't resolve my bot member in this server.",
        });
      }

      const perms = targetChannel.permissionsFor(botMember);

      if (!perms?.has(PermissionFlagsBits.ViewChannel)) {
        return respond(interaction, {
          content: `❌ I cannot view ${targetChannel}.`,
        });
      }

      if (!perms?.has(PermissionFlagsBits.SendMessages)) {
        return respond(interaction, {
          content: `❌ I cannot send messages in ${targetChannel}.`,
        });
      }

      if (!perms?.has(PermissionFlagsBits.EmbedLinks)) {
        return respond(interaction, {
          content: `❌ I cannot embed links in ${targetChannel}.`,
        });
      }

      const panelEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setFooter({
          text: "Press the button below to create a ticket.",
        })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_create")
          .setLabel("Open Ticket")
          .setStyle(ButtonStyle.Primary)
          .setEmoji("🎫"),
      );

      const sentMessage = await targetChannel.send({
        embeds: [panelEmbed],
        components: [row],
      });

      return respond(interaction, {
        content: `✅ Ticket panel posted in ${targetChannel}.\nMessage ID: \`${sentMessage.id}\``,
      });
    } catch (error) {
      console.error("[ticket-panel] error:", error);

      return respond(interaction, {
        content: "❌ Failed to post the ticket panel.",
      });
    }
  },
};
