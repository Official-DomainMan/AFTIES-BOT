const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levelreset")
    .setDescription("⚠️ Reset all leveling stats for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      const guildId = interaction.guild.id;

      await interaction.reply({
        content: "🧹 Resetting leveling data…",
        ephemeral: true,
      });

      await prisma.levelProfile.deleteMany({
        where: { guildId },
      });

      await prisma.levelRole.deleteMany({
        where: { guildId },
      });

      await prisma.levelSettings.deleteMany({
        where: { guildId },
      });

      await interaction.followUp({
        content: "✨ All levels, roles, and settings reset for this server.",
        ephemeral: true,
      });
    } catch (err) {
      console.error("[levelreset] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Failed to reset leveling data.",
          ephemeral: true,
        });
      }
    }
  },
};
