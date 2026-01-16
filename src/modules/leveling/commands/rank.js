const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Show your level & XP, or someone else's.")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("Whose rank to view?")
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const target = interaction.options.getUser("user") ?? interaction.user;

      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      const guildId = interaction.guild.id;
      const userId = target.id;

      const profile = await prisma.levelProfile.findUnique({
        where: {
          guildId_userId: { guildId, userId },
        },
      });

      const level = profile?.level ?? 0;
      const xp = profile?.xp ?? 0;

      // Compute rank (position in leaderboard)
      const betterCount = await prisma.levelProfile.count({
        where: {
          guildId,
          OR: [
            { level: { gt: level } },
            {
              level,
              xp: { gt: xp },
            },
          ],
        },
      });

      const rank = betterCount + 1;

      const embed = new EmbedBuilder()
        .setAuthor({
          name: `${target.username}'s Rank`,
          iconURL: target.displayAvatarURL({ size: 128 }),
        })
        .setColor(0x5865f2)
        .addFields(
          { name: "Level", value: `**${level}**`, inline: true },
          { name: "XP", value: `**${xp}**`, inline: true },
          { name: "Server Rank", value: `#${rank}`, inline: true }
        )
        .setFooter({ text: interaction.guild.name })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[rank] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /rank.",
          ephemeral: true,
        });
      }
    }
  },
};
