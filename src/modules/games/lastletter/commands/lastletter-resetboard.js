const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lastletter-resetboard")
    .setDescription("Reset the Last Letter leaderboard for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command can only be used in servers.",
          flags: 64, // ephemeral
        });
      }

      const guildId = interaction.guild.id;

      await interaction.deferReply({ flags: 64 }); // ephemeral

      const deleted = await prisma.lastLetterScore.deleteMany({
        where: { guildId },
      });

      const embed = new EmbedBuilder()
        .setTitle("🏆 Leaderboard Reset Complete")
        .setDescription(
          `Leaderboard has been wiped for **${interaction.guild.name}**.\n\n` +
            `🗑️ **Deleted entries:** \`${deleted.count}\`\n\n` +
            `Start playing again to repopulate the board!`,
        )
        .setColor(0xffbe0b)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[lastletter-resetboard] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error resetting board.",
          flags: 64,
        });
      }
    }
  },
};
