// src/modules/leveling/commands/level.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");
const { getRequiredXpForLevel } = require("../handler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("level")
    .setDescription("Show your level or another user's level.")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("Whose level do you want to see?")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      const guildId = interaction.guild.id;
      const targetUser =
        interaction.options.getUser("user") || interaction.user;

      const profile = await prisma.levelProfile.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId: targetUser.id,
          },
        },
      });

      if (!profile) {
        return interaction.reply({
          content:
            targetUser.id === interaction.user.id
              ? "You don't have any XP yet. Start chatting."
              : `${targetUser.username} doesn't have any XP yet.`,
          ephemeral: true,
        });
      }

      const currentLevel = profile.level;
      const currentXp = profile.xp;
      const requiredForNext = getRequiredXpForLevel(currentLevel + 1) || 1;

      // Clamp progress between 0% and 100%
      const ratio = Math.max(0, Math.min(1, currentXp / requiredForNext));
      const percent = (ratio * 100).toFixed(1);
      const xpToNext = Math.max(0, requiredForNext - currentXp);

      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${targetUser.username}'s Level`,
          iconURL: targetUser.displayAvatarURL(),
        })
        .setColor(0x9b59b6)
        .addFields(
          {
            name: "Level",
            value: `\`${currentLevel}\``,
            inline: true,
          },
          {
            name: "XP",
            value: `\`${currentXp} / ${requiredForNext}\``,
            inline: true,
          },
          {
            name: "Progress",
            value: `${percent}% — \`${xpToNext}\` XP to next level`,
            inline: false,
          }
        )
        .setFooter({
          text: "XP from chatting. Voice XP coming soon™",
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[level] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /level.",
          ephemeral: true,
        });
      }
    }
  },
};
