// src/modules/economy/commands/daily.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { claimDaily } = require("../economy");

function formatRemaining(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily coins for the casino."),

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

      const result = await claimDaily(guildId, userId);

      if (!result.success) {
        const remaining = formatRemaining(result.remainingMs);
        const embed = new EmbedBuilder()
          .setTitle("⏰ Daily already claimed")
          .setDescription(
            `You’ve already grabbed your daily today.\n\nCome back in **${remaining}**.`,
          )
          .setColor(0xe67e22);

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setTitle("💸 Daily Reward")
        .setDescription(
          `You claimed **${result.amount.toLocaleString()}** coins.\n\nNew balance: **${result.newBalance.toLocaleString()}**`,
        )
        .setColor(0x2ecc71)
        .setFooter({ text: "Go lose it all in blackjack, king. ♠️" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: false });
    } catch (err) {
      console.error("[daily] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /daily.",
          ephemeral: true,
        });
      }
    }
  },
};
