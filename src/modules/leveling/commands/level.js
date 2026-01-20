// src/modules/leveling/commands/level.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");
const { getRequiredXpForLevel } = require("../handler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("level")
    .setDescription("Show your current level and XP."),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      // Get this user's profile for this guild
      const profile = await prisma.levelProfile.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      if (!profile) {
        return interaction.reply({
          content: "You don't have any XP yet. Start talking your shit 💅",
          ephemeral: true,
        });
      }

      const level = profile.level;
      const xp = profile.xp;

      const nextLevel = level + 1;
      const requiredForNext = getRequiredXpForLevel(nextLevel);

      let progressText = "Max level reached 🔥";
      let xpLine = `XP: **${xp}**`;

      if (requiredForNext > 0) {
        const progressPercent = Math.max(
          0,
          Math.min(100, Math.round((xp / requiredForNext) * 100)),
        );

        progressText = `Progress: **${progressPercent}%** — **${requiredForNext - xp} XP** to next level`;
        xpLine = `XP: **${xp} / ${requiredForNext}**`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📈 Level Stats — ${interaction.user.username}`)
        .setDescription(
          [`Level: **${level}**`, xpLine, progressText].join("\n"),
        )
        .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
        .setColor(0x9b59b6)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[level command] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error showing your level.",
          ephemeral: true,
        });
      }
    }
  },
};
