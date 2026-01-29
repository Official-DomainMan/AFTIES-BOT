const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  async createTicket(interaction) {
    try {
      const guild = interaction.guild;
      const user = interaction.user;

      // Prevent spammy double tickets
      const existing = guild.channels.cache.find(
        (c) =>
          c.name === `ticket-${user.id}` && c.topic === `ticket for ${user.id}`,
      );

      if (existing) {
        return interaction.reply({
          content:
            "❗ You already have an open ticket! Please use that one or ask staff to close it.",
          ephemeral: true,
        });
      }

      // Create the ticket channel
      const channel = await guild.channels.create({
        name: `ticket-${user.id}`,
        type: ChannelType.GuildText,
        topic: `ticket for ${user.id}`,
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          // Give staff + bot access
          {
            id: guild.roles.cache.find((r) =>
              r.permissions.has(PermissionFlagsBits.ManageChannels),
            ),
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
          {
            id: interaction.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
            ],
          },
        ],
      });

      const ticketEmbed = new EmbedBuilder()
        .setTitle("🎫 Support Ticket")
        .setDescription(
          "Thanks for contacting support! A staff member will be with you shortly.",
        )
        .setColor(0x00aeff);

      const closeRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("ticket_close")
          .setLabel("🔒 Close Ticket")
          .setStyle(ButtonStyle.Danger),
      );

      await channel.send({
        content: `<@${user.id}>`,
        embeds: [ticketEmbed],
        components: [closeRow],
      });

      await interaction.reply({
        content: `✅ Your ticket has been created: ${channel}`,
        ephemeral: true,
      });
    } catch (err) {
      console.error("[tickets] createTicket error:", err);
      if (!interaction.replied) {
        await interaction.reply({
          content: "❌ Could not create your ticket.",
          ephemeral: true,
        });
      }
    }
  },

  async closeTicket(interaction) {
    try {
      const channel = interaction.channel;

      // Confirm it's a ticket by topic
      if (!channel.topic || !channel.topic.startsWith("ticket for")) {
        return interaction.reply({
          content: "❌ This is not a ticket channel.",
          ephemeral: true,
        });
      }

      await channel.permissionOverwrites.edit(interaction.user.id, {
        ViewChannel: false,
      });

      await channel.send({
        content: "🔒 Ticket closed. Staff may archive this channel.",
      });

      await interaction.reply({
        content: "🛑 Ticket closed.",
        ephemeral: true,
      });
    } catch (err) {
      console.error("[tickets] closeTicket error:", err);
      if (!interaction.replied) {
        await interaction.reply({
          content: "❌ Could not close this ticket.",
          ephemeral: true,
        });
      }
    }
  },
};
