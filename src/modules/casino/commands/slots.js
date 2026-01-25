// src/modules/casino/commands/slots.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

const SYMBOLS = ["🍒", "🍋", "🍇", "🔔", "⭐", "💎", "7️⃣"];

async function getOrCreateWallet(guildId, userId) {
  const profile = await prisma.economyProfile.upsert({
    where: { guildId_userId: { guildId, userId } },
    update: {},
    create: {
      guildId,
      userId,
      balance: 0,
    },
  });
  return profile;
}

async function adjustBalance(guildId, userId, amount) {
  const profile = await prisma.economyProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: {
      balance: { increment: amount },
    },
  });
  return profile;
}

function spin() {
  return [
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slots")
    .setDescription("Spin the AFTIES slut slots.")
    .addIntegerOption((opt) =>
      opt
        .setName("bet")
        .setDescription("How much to bet.")
        .setRequired(true)
        .setMinValue(1),
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      const bet = interaction.options.getInteger("bet", true);
      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      let wallet = await getOrCreateWallet(guildId, userId);
      if (wallet.balance < bet) {
        return interaction.reply({
          content: `❌ You don't have enough coins to bet \`${bet}\`. Your balance is \`${wallet.balance}\`.`,
          ephemeral: true,
        });
      }

      // Take bet
      wallet = await adjustBalance(guildId, userId, -bet);

      const result = spin();
      const [a, b, c] = result;

      let payout = 0;
      let title = "🎰 Slots";
      let flavor = "";

      if (a === b && b === c) {
        // Three of a kind
        // Slightly different payouts for rare symbol "7️⃣" or "💎"
        if (a === "7️⃣") {
          payout = bet * 15;
          flavor = "JACKPOT 7️⃣7️⃣7️⃣!";
        } else if (a === "💎") {
          payout = bet * 10;
          flavor = "💎 Triple diamonds, you bougie menace.";
        } else {
          payout = bet * 6;
          flavor = "Triple match! House is pissed.";
        }
      } else if (a === b || a === c || b === c) {
        // Two of a kind
        payout = Math.floor(bet * 1.5);
        flavor = "Nice lil two-of-a-kind.";
      } else {
        payout = 0;
        flavor = "L + ratio + the house eats.";
      }

      let netChange = -bet;
      if (payout > 0) {
        wallet = await adjustBalance(guildId, userId, payout);
        netChange = payout - bet;
      }

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setColor(payout > 0 ? 0x2ecc71 : 0xe74c3c)
        .setDescription(
          [
            `**Result:** \`${result.join(" | ")}\``,
            "",
            flavor,
            "",
            `**Bet:** \`${bet}\``,
            `**Payout:** \`${payout}\``,
            `**Net:** \`${netChange >= 0 ? "+" : ""}${netChange}\``,
            `**Balance:** \`${wallet.balance}\``,
          ].join("\n"),
        )
        .setFooter({ text: "AFTIES Slots — rigged but cute." })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[slots] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /slots.",
          ephemeral: true,
        });
      }
    }
  },
};
