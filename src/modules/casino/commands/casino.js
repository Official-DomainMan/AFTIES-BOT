// src/modules/casino/commands/casino.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("casino")
    .setDescription("View the slutty casino menu, games, and your balance."),

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

      // Get or create economy profile
      const profile = await prisma.economyProfile.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        update: {},
        create: {
          guildId,
          userId,
          balance: 0,
        },
      });

      const balance = profile.balance ?? 0;

      const embed = new EmbedBuilder()
        .setTitle("🎰 AFTIES CASINO LOBBY")
        .setDescription(
          [
            `Welcome, <@${userId}>.`,
            "",
            `**Your Balance:** \`${balance}\` 💵`,
            "",
            "**Available Games**",
            "🃏 `/blackjack <bet>` — classic 21, slutty edition",
            "🎰 `/slots <bet>` — spin for chaos",
            "🎡 `/roulette <bet> <choice>` — red / black / green",
            "",
            "**Economy Commands**",
            "💸 `/daily` — claim your daily stipend",
            "💳 `/balance` — check your wallet",
            "📈 `/levels`, `/profile` — flex your grind",
          ].join("\n"),
        )
        .setColor(0x9b59b6)
        .setFooter({ text: "Gamble responsibly, menace irresponsibly." })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[casino] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error opening the casino menu.",
          ephemeral: true,
        });
      }
    }
  },
};
