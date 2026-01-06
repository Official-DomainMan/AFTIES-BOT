const { SlashCommandBuilder } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("counting-leaderboard")
    .setDescription("Show the top counters in this server")
    .addIntegerOption((o) =>
      o
        .setName("limit")
        .setDescription("How many to show (default 10, max 25)")
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply(); // visible reply

    const limitRaw = interaction.options.getInteger("limit") ?? 10;
    const limit = Math.max(1, Math.min(25, limitRaw));

    const top = await prisma.countingUserStat.findMany({
      where: { guildId: interaction.guild.id },
      orderBy: [{ points: "desc" }, { lastCount: "desc" }],
      take: limit,
    });

    if (top.length === 0) {
      await interaction.editReply(
        "ℹ️ No counting stats yet. Start counting to build the leaderboard."
      );
      return;
    }

    const lines = top.map((row, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•";
      return `${medal} <@${row.userId}> — **${row.points}**`;
    });

    await interaction.editReply(
      `🏆 **Counting Leaderboard (Top ${limit})**\n` + lines.join("\n")
    );
  },
};
