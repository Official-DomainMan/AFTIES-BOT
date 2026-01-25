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
    .setDescription("Open the AFTIES casino menu."),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId("casino-menu")
        .setPlaceholder("Pick your poison 🎰")
        .addOptions(
          {
            label: "Blackjack",
            description: "Play interactive blackjack with Hit / Stand.",
            value: "blackjack",
            emoji: "🃏",
          },
          {
            label: "Slots",
            description: "Spin the reels and hope for a win.",
            value: "slots",
            emoji: "🎰",
          },
          {
            label: "Roulette",
            description: "Bet on red, black, or numbers.",
            value: "roulette",
            emoji: "🎡",
          },
          {
            label: "Daily Reward",
            description: "Claim your daily coins.",
            value: "daily",
            emoji: "📆",
          },
          {
            label: "Balance",
            description: "Check your casino balance.",
            value: "balance",
            emoji: "💰",
          },
          {
            label: "Transaction Log",
            description: "View your recent casino transactions.",
            value: "transaction-log",
            emoji: "📜",
          },
        );

      const row = new ActionRowBuilder().addComponents(menu);

      const embed = new EmbedBuilder()
        .setTitle("🎲 AFTIES Casino")
        .setDescription(
          [
            "Welcome to the casino. Pick an option from the menu below:",
            "",
            "🃏 **Blackjack** — `/blackjack`",
            "🎰 **Slots** — `/slots`",
            "🎡 **Roulette** — `/roulette`",
            "📆 **Daily Reward** — `/daily`",
            "💰 **Balance** — `/balance`",
            "📜 **Transaction Log** — `/transaction-log`",
          ].join("\n"),
        )
        .setColor(0x9b59b6)
        .setTimestamp();

      const reply = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true, // casino menu just for the user
        fetchReply: true,
      });

      const collector = reply.createMessageComponentCollector({
        time: 60_000,
        filter: (i) =>
          i.user.id === interaction.user.id && i.customId === "casino-menu",
      });

      collector.on("collect", async (selectInteraction) => {
        const choice = selectInteraction.values[0];

        let msg;
        switch (choice) {
          case "blackjack":
            msg = "🃏 Use `/blackjack` to start a blackjack game.";
            break;
          case "slots":
            msg = "🎰 Use `/slots` to spin the slots.";
            break;
          case "roulette":
            msg = "🎡 Use `/roulette` to place your bet.";
            break;
          case "daily":
            msg = "📆 Use `/daily` to claim your daily reward.";
            break;
          case "balance":
            msg = "💰 Use `/balance` to check your casino balance.";
            break;
          case "transaction-log":
            msg =
              "📜 Use `/transaction-log` to view your recent casino transactions.";
            break;
          default:
            msg = "❔ Unknown option.";
        }

        await selectInteraction.reply({
          content: msg,
          ephemeral: true,
        });
      });

      collector.on("end", async () => {
        try {
          const msg = await interaction.fetchReply().catch(() => null);
          if (!msg) return;

          await msg
            .edit({
              components: [],
            })
            .catch(() => {});
        } catch {
          // ignore
        }
      });
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
