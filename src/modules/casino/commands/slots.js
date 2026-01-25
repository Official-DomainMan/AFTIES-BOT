// src/modules/casino/commands/slots.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

const SYMBOLS = ["🍒", "🍋", "🍇", "💎", "7️⃣", "🍀"];

async function getOrCreateProfile(guildId, userId) {
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

function spinReels() {
  return [
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
  ];
}

function computePayout(bet, reels) {
  const [a, b, c] = reels;

  // 3 of a kind
  if (a === b && b === c) {
    if (a === "7️⃣") {
      // big win
      return bet * 3; // net +3*bet
    }
    if (a === "💎") {
      return bet * 2; // net +2*bet
    }
    return bet * 2; // net +2*bet for other triple
  }

  // 2 of a kind -> push (no change)
  if (a === b || a === c || b === c) {
    return 0;
  }

  // no match: lose bet
  return -bet;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slots")
    .setDescription("Spin the slots.")
    .addIntegerOption((option) =>
      option
        .setName("bet")
        .setDescription("How much do you want to bet?")
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

      const guildId = interaction.guild.id;
      const userId = interaction.user.id;
      const bet = interaction.options.getInteger("bet", true);

      let profile = await getOrCreateProfile(guildId, userId);

      if (profile.balance < bet) {
        return interaction.reply({
          content: "You don't have enough coins for that bet.",
          ephemeral: true,
        });
      }

      const reels = spinReels();
      const delta = computePayout(bet, reels);

      let resultText;
      let txType = null;

      if (delta > 0) {
        resultText = `🎉 You **win** \`${delta}\` coins!`;
        txType = "SLOTS_WIN";
      } else if (delta < 0) {
        resultText = `💸 You **lose** \`${Math.abs(delta)}\` coins.`;
        txType = "SLOTS_LOSS";
      } else {
        resultText = "😶 It's a push. No coins change hands.";
      }

      if (delta !== 0) {
        profile = await prisma.economyProfile.update({
          where: {
            guildId_userId: { guildId, userId },
          },
          data: {
            balance: {
              increment: delta,
            },
          },
        });

        await prisma.economyTransaction.create({
          data: {
            guildId,
            userId,
            type: txType,
            amount: delta,
            note: `Slots bet ${bet} | ${reels.join(" ")}`,
          },
        });
      } else {
        profile = await prisma.economyProfile.findUnique({
          where: {
            guildId_userId: { guildId, userId },
          },
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🎰 Slots")
        .setDescription(
          `**Result:** ${reels.join("  ")}\n\n` +
            `${resultText}\n\n` +
            `**Bet:** ${bet} coins\n` +
            `**New Balance:** ${profile.balance} coins`,
        )
        .setColor(0xe67e22)
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
