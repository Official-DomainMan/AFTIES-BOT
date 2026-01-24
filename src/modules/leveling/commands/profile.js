const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");
const { getRequiredXpForLevel } = require("../handler");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show your leveling stats (or someone else's).")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Whose profile do you want to see?")
        .setRequired(false),
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
      const targetMember =
        interaction.guild.members.cache.get(targetUser.id) ||
        (await interaction.guild.members
          .fetch(targetUser.id)
          .catch(() => null));

      // Get profile if it exists
      let profile = await prisma.levelProfile.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId: targetUser.id,
          },
        },
      });

      // Default values if they’ve never talked
      let level = 0;
      let xp = 0;

      if (profile) {
        level = profile.level;
        xp = profile.xp;
      }

      const nextLevel = level + 1;
      const requiredForNext = getRequiredXpForLevel(nextLevel);

      let progressLine = "Maxed out? (dev check pls)";
      let progressPercentText = "0%";
      let xpLine = "XP: 0";

      if (requiredForNext > 0) {
        const rawPct = (xp / requiredForNext) * 100;
        const pct = Math.max(0, Math.min(100, Math.round(rawPct)));

        progressPercentText = `${pct}%`;
        xpLine = `XP: **${xp} / ${requiredForNext}** to next level`;

        const totalBlocks = 10;
        const filledBlocks = Math.round((pct / 100) * totalBlocks);
        const bar =
          "▰".repeat(filledBlocks) + "▱".repeat(totalBlocks - filledBlocks);

        progressLine = `${bar}  (${progressPercentText})`;
      }

      const displayName =
        (targetMember && targetMember.displayName) || targetUser.username;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${displayName}'s Profile`,
          iconURL: targetUser.displayAvatarURL({ dynamic: true }),
        })
        .setColor(0xf1c40f)
        .addFields(
          {
            name: "Level",
            value: `**${level}**`,
            inline: true,
          },
          {
            name: "XP",
            value: xpLine,
            inline: true,
          },
          {
            name: "Progress",
            value: progressLine,
          },
        )
        .setFooter({
          text: "XP from chatting + talking in VC",
        })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[profile] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /profile.",
          ephemeral: true,
        });
      }
    }
  },
};
