// src/modules/games/lastletter/commands/lastletter-reset.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lastletter-reset")
    .setDescription("Reset the Last Letter game chain for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        console.warn("[lastletter-reset] used outside guild");
        return;
      }

      const guildId = interaction.guild.id;

      const state = await prisma.lastLetterState.findUnique({
        where: { guildId },
      });

      if (!state) {
        await interaction.reply({
          content:
            "⚠️ Last Letter is not configured for this server. Use `/lastletter-set` first.",
          ephemeral: true,
        });
        return;
      }

      // Only clear the last word so the next word can start fresh.
      await prisma.lastLetterState.update({
        where: { guildId },
        data: {
          lastWord: "", // empty string = falsy in handler
          // do NOT touch lastUserId to avoid nullability issues
        },
      });

      await interaction.reply({
        content:
          "🔄 Last Letter chain has been reset. Any valid word can start the game again.",
        ephemeral: true,
      });
    } catch (err) {
      console.error("lastletter-reset error:", err);
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: "❌ Error running command.",
            ephemeral: true,
          });
        }
      } catch {
        // ignore reply failure
      }
    }
  },
};
