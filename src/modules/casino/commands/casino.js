// src/modules/casino/commands/casino.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

async function getOrCreateEconomyProfile(guildId, userId) {
  let profile = await prisma.economyProfile.findUnique({
    where: {
      guildId_userId: { guildId, userId },
    },
  });

  if (!profile) {
    profile = await prisma.economyProfile.create({
      data: {
        guildId,
        userId,
        balance: 0,
      },
    });
  }

  return profile;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("casino")
    .setDescription("Open the AFTIES Casino lobby."),

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

      const profile = await getOrCreateEconomyProfile(guildId, userId);

      const embed = new EmbedBuilder()
        .setTitle("🎰 AFTIES CASINO LOBBY")
        .setDescription(
          [
            `Welcome, ${interaction.user}.`,
            "",
            `**Your Balance:** ${profile.balance} 🪙`,
            "",
            "**Available Games**",
            " `/blackjack <bet>` — classic 21",
            " `/slots <bet>` — spin the reels",
            " `/roulette <bet> <choice>` — red / black / green",
            "",
            "**Economy Commands**",
            " `/daily` — claim your daily stipend",
            " `/balance` — check your wallet",
            " `/work` — clock in & maybe get paid",
            " `/transaction-log` — view your recent transactions",
            " `/levels`, `/profile` — flex your grind",
            "",
            "Gamble responsibly, menace irresponsibly.",
          ].join("\n"),
        )
        .setColor(0xe67e22)
        .setFooter({ text: "AFTIES Casino • House always watching." })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: false });
    } catch (err) {
      console.error("[casino] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error opening the casino lobby.",
          ephemeral: true,
        });
      }
    }
  },
};
