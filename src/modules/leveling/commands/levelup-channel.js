// src/modules/leveling/commands/levelup-channel.js
const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levelup-channel")
    .setDescription("Set or clear the channel for level-up announcements.")
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription(
          "Channel where level-up messages will be sent. Leave empty to reset to message channel.",
        )
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      // Guild-only
      if (!interaction.guild) {
        return interaction.reply({
          content: "❌ This command can only be used in a server.",
          ephemeral: true,
        });
      }

      // Permission check (Manage Server)
      const member = interaction.member;
      if (
        !member.permissions.has(PermissionsBitField.Flags.ManageGuild) &&
        !member.permissions.has(PermissionsBitField.Flags.Administrator)
      ) {
        return interaction.reply({
          content:
            "❌ You need **Manage Server** permissions to use this command.",
          ephemeral: true,
        });
      }

      const guildId = interaction.guild.id;
      const chosenChannel = interaction.options.getChannel("channel");

      let description;
      if (!chosenChannel) {
        // Clear / reset behavior – go back to "same channel as message"
        await prisma.levelSettings.upsert({
          where: { guildId },
          update: { levelUpChannelId: null },
          create: {
            guildId,
            levelUpChannelId: null,
          },
        });

        description =
          "Level-up messages will now appear in **whichever text channel** the user leveled up in.";
      } else {
        // Set specific channel
        await prisma.levelSettings.upsert({
          where: { guildId },
          update: { levelUpChannelId: chosenChannel.id },
          create: {
            guildId,
            levelUpChannelId: chosenChannel.id,
          },
        });

        description = `Level-up messages will now be sent in ${chosenChannel}.`;
      }

      const embed = new EmbedBuilder()
        .setTitle("⚙️ Level-Up Channel Updated")
        .setDescription(description)
        .setColor(0x2ecc71)
        .setFooter({ text: "Use /levelup-channel with no channel to reset." })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error("[levelup-channel] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error updating level-up channel.",
          ephemeral: true,
        });
      }
    }
  },
};
