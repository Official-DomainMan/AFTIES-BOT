const { SlashCommandBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levelreset")
    .setDescription("Reset all leveling data for this server."),

  /**
   * Reset ALL leveling data for this guild:
   * - LevelProfile (xp & levels)
   * - LevelRole (role rewards)
   * - LevelConfig (announce channel, etc.)
   */
  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "❌ This command can only be used in a server.",
          ephemeral: true,
        });
      }

      // Optional: restrict to admins
      if (!interaction.memberPermissions?.has("Administrator")) {
        return interaction.reply({
          content: "❌ Only admins can reset leveling.",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guild.id;

      // Wipe all leveling-related data for this guild
      await prisma.levelProfile.deleteMany({
        where: { guildId },
      });

      // If your schema uses LevelRole (what we set up earlier)
      await prisma.levelRole.deleteMany({
        where: { guildId },
      });

      // Guild-level leveling config (announce channel, etc.)
      await prisma.levelConfig.deleteMany({
        where: { guildId },
      });

      // ✅ Final success message
      await interaction.editReply(
        "✨ All levels, roles, and settings reset for this server."
      );
    } catch (err) {
      console.error("[levelreset] error:", err);

      // If something blows up, try to surface a clean error
      if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: "❌ Error running /levelreset.",
          ephemeral: true,
        });
      } else {
        // If we already deferred, use editReply or followUp
        try {
          await interaction.editReply({
            content: "❌ Error running /levelreset.",
          });
        } catch {
          await interaction.followUp({
            content: "❌ Error running /levelreset.",
            ephemeral: true,
          });
        }
      }
    }
  },
};
