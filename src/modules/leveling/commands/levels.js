const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levels")
    .setDescription("Show the top leveled users in this server."),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      const guildId = interaction.guild.id;

      const top = await prisma.levelProfile.findMany({
        where: { guildId },
        orderBy: [{ level: "desc" }, { xp: "desc" }],
        take: 10,
      });

      if (top.length === 0) {
        return interaction.reply({
          content: "Nobody has any XP yet. Start chatting!",
          ephemeral: true,
        });
      }

      const lines = await Promise.all(
        top.map(async (row, index) => {
          const place = index + 1;
          const userMention = `<@${row.userId}>`;
          const lvl = row.level;
          const xp = row.xp;

          const medal =
            place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "🔹";

          return `${medal} **#${place}** — ${userMention} — Level **${lvl}**, XP **${xp}**`;
        })
      );

      const embed = new EmbedBuilder()
        .setTitle(`🏆 Top Leveling — ${interaction.guild.name}`)
        .setDescription(lines.join("\n"))
        .setColor(0xf1c40f)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[levels] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /levels.",
          ephemeral: true,
        });
      }
    }
  },
};
