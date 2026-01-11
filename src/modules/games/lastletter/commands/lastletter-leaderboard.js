// src/modules/games/lastletter/commands/lastletter-leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lastletter-leaderboard")
    .setDescription("Show the Last Letter leaderboard for this server"),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        await interaction.reply({
          content: "❌ This command can only be used in a server.",
          ephemeral: true,
        });
        return;
      }

      const guildId = interaction.guild.id;

      const top = await prisma.lastLetterScore.findMany({
        where: { guildId },
        orderBy: { score: "desc" },
        take: 10,
      });

      if (top.length === 0) {
        await interaction.reply({
          content:
            "📉 No one has scored in Last Letter yet. Be the first to play!",
          ephemeral: false, // public message saying “no scores yet”
        });
        return;
      }

      const lines = [];
      let rank = 1;

      for (const entry of top) {
        const userId = entry.userId;
        let displayName = `<@${userId}>`;

        try {
          const member = await interaction.guild.members.fetch(userId);
          displayName = member.displayName || `<@${userId}>`;
        } catch {
          // user may have left; keep mention
        }

        lines.push(`**${rank}.** ${displayName} — **${entry.score}** pts`);
        rank++;
      }

      const embed = new EmbedBuilder()
        .setTitle("🏆 Last Letter Leaderboard")
        .setDescription(lines.join("\n"))
        .setColor(0xff66cc)
        .setFooter({
          text: "Points = word length (4 letters = 4 pts, 5 letters = 5 pts, etc.)",
        });

      await interaction.reply({
        embeds: [embed],
        ephemeral: false, // 🔥 visible to everyone
      });
    } catch (err) {
      console.error("lastletter-leaderboard error:", err);
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: "❌ Error running command.",
            ephemeral: true,
          });
        }
      } catch {
        // ignore
      }
    }
  },
};
