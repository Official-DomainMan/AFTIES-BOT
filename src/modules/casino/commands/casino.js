// src/modules/casino/commands/casino.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("casino")
    .setDescription("Open the casino menu."),

  async execute(interaction) {
    try {
      const embed = new EmbedBuilder()
        .setTitle("🎲 AFTIES Casino")
        .setDescription(
          [
            "Welcome to the casino.",
            "",
            "🃏 **Blackjack** — `/blackjack`",
            "🎰 **Slots** — `/slots`",
            "🎡 **Roulette** — `/roulette`",
            "📆 **Daily Reward** — `/daily`",
            "💰 **Balance** — `/balance`",
            "📜 **Transaction Log** — `/transaction-log`",
          ].join("\n"),
        )
        .setColor(0x9b59b6);

      const menu = new StringSelectMenuBuilder()
        .setCustomId("casino-menu")
        .setPlaceholder("Select an option")
        .addOptions(
          {
            label: "Blackjack",
            value: "blackjack",
            emoji: "🃏",
          },
          {
            label: "Slots",
            value: "slots",
            emoji: "🎰",
          },
          {
            label: "Roulette",
            value: "roulette",
            emoji: "🎡",
          },
          {
            label: "Daily Reward",
            value: "daily",
            emoji: "📆",
          },
          {
            label: "Balance",
            value: "balance",
            emoji: "💰",
          },
          {
            label: "Transaction Log",
            value: "transaction-log",
            emoji: "📜",
          },
        );

      const row = new ActionRowBuilder().addComponents(menu);

      await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });
    } catch (err) {
      console.error("[casino] error:", err);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Failed to open the casino menu.",
          ephemeral: true,
        });
      }
    }
  },
};
