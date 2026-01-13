// src/modules/games/lastletter/commands/lastletter-streak.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lastletter-streak")
    .setDescription(
      "View the current and best streak for the Last Letter game."
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        ephemeral: true,
      });
    }

    const guildId = interaction.guild.id;

    try {
      const state = await prisma.lastLetterState.findUnique({
        where: { guildId },
      });

      if (!state) {
        return interaction.reply({
          content:
            "ℹ️ Last Letter hasn't been set up yet. Use `/lastletter-set` first!",
          ephemeral: true,
        });
      }

      const current = state.currentStreak ?? 0;
      const best = state.bestStreak ?? 0;

      const embed = new EmbedBuilder()
        .setTitle("🔠 Last Letter — Streak Stats")
        .setColor(0x5865f2)
        .addFields(
          {
            name: "🔥 Current Streak",
            value: current.toString(),
            inline: true,
          },
          {
            name: "🏆 Best Streak",
            value: best.toString(),
            inline: true,
          },
          {
            name: "📍 Game Channel",
            value: `<#${state.channelId}>`,
            inline: false,
          }
        )
        .setFooter({ text: "Keep the chain going…" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("lastletter-streak error:", err);

      if (!interaction.replied && !interaction.deferred) {
        try {
          return interaction.reply({
            content: "❌ Error fetching streak data.",
            ephemeral: true,
          });
        } catch {}
      }
    }
  },
};
