// src/modules/economy/commands/transaction-log.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

const TYPE_LABELS = {
  DAILY: "Daily reward",
  PAY_SENT: "Payment sent",
  PAY_RECEIVED: "Payment received",
  BLACKJACK_WIN: "Blackjack win",
  BLACKJACK_LOSS: "Blackjack loss",
  SLOTS_WIN: "Slots win",
  SLOTS_LOSS: "Slots loss",
  ROULETTE_WIN: "Roulette win",
  ROULETTE_LOSS: "Roulette loss",
};

function formatAmount(amount) {
  const sign = amount > 0 ? "+" : "";
  const emoji = amount > 0 ? "🟢" : amount < 0 ? "🔴" : "⚪";
  return `${emoji} \`${sign}${amount}\``;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("transaction-log")
    .setDescription("View your recent casino transactions."),

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

      const rows = await prisma.economyTransaction.findMany({
        where: {
          guildId,
          userId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10, // show last 10
      });

      if (rows.length === 0) {
        return interaction.reply({
          content:
            "📭 No transactions yet. Go claim `/daily` or hit the casino.",
          ephemeral: true,
        });
      }

      const lines = rows.map((tx) => {
        const label = TYPE_LABELS[tx.type] || tx.type;
        const when = tx.createdAt.toLocaleString?.() ?? tx.createdAt;
        const note = tx.note ? ` — _${tx.note}_` : "";
        return `• **${label}** ${formatAmount(tx.amount)}\n  <t:${Math.floor(
          tx.createdAt.getTime() / 1000,
        )}:R>${note}`;
      });

      const embed = new EmbedBuilder()
        .setTitle(`📑 Transaction Log — ${interaction.user.username}`)
        .setDescription(lines.join("\n\n"))
        .setColor(0x9b59b6)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error("[transaction-log] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /transaction-log.",
          ephemeral: true,
        });
      }
    }
  },
};
