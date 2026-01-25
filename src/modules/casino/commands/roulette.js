// src/modules/casino/commands/roulette.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

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

// Very simple color model:
// 0 = green
// even = black, odd = red
function spinWheel() {
  const number = Math.floor(Math.random() * 37); // 0..36
  let color;
  if (number === 0) {
    color = "green";
  } else if (number % 2 === 0) {
    color = "black";
  } else {
    color = "red";
  }
  return { number, color };
}

function computeRouletteDelta(bet, guessColor, spinColor) {
  if (guessColor === spinColor) {
    if (guessColor === "green") {
      // Big payout for green
      return bet * 14; // net +14*bet
    }
    // red/black 1:1
    return bet;
  }
  // lose bet
  return -bet;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("Bet on red, black, or green.")
    .addIntegerOption((option) =>
      option
        .setName("bet")
        .setDescription("How much do you want to bet?")
        .setRequired(true)
        .setMinValue(1),
    )
    .addStringOption((option) =>
      option
        .setName("color")
        .setDescription("Which color do you want to bet on?")
        .setRequired(true)
        .addChoices(
          { name: "Red", value: "red" },
          { name: "Black", value: "black" },
          { name: "Green (0)", value: "green" },
        ),
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
      const guessColor = interaction.options.getString("color", true); // red / black / green

      let profile = await getOrCreateProfile(guildId, userId);

      if (profile.balance < bet) {
        return interaction.reply({
          content: "You don't have enough coins for that bet.",
          ephemeral: true,
        });
      }

      const spin = spinWheel();
      const delta = computeRouletteDelta(bet, guessColor, spin.color);

      let resultText;
      let txType = null;

      if (delta > 0) {
        resultText = `🎉 You **win** \`${delta}\` coins!`;
        txType = "ROULETTE_WIN";
      } else if (delta < 0) {
        resultText = `💸 You **lose** \`${Math.abs(delta)}\` coins.`;
        txType = "ROULETTE_LOSS";
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
            note: `Roulette bet ${bet} on ${guessColor}`,
          },
        });
      } else {
        profile = await prisma.economyProfile.findUnique({
          where: {
            guildId_userId: { guildId, userId },
          },
        });
      }

      const colorEmoji =
        spin.color === "red" ? "🔴" : spin.color === "black" ? "⚫" : "🟢";

      const guessEmoji =
        guessColor === "red" ? "🔴" : guessColor === "black" ? "⚫" : "🟢";

      const embed = new EmbedBuilder()
        .setTitle("🎡 Roulette")
        .setDescription(
          `**You bet:** ${guessEmoji} \`${guessColor.toUpperCase()}\`\n` +
            `**Spin result:** ${colorEmoji} \`${spin.color.toUpperCase()}\` — **${spin.number}**\n\n` +
            `${resultText}\n\n` +
            `**Bet:** ${bet} coins\n` +
            `**New Balance:** ${profile.balance} coins`,
        )
        .setColor(0xc0392b)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[roulette] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /roulette.",
          ephemeral: true,
        });
      }
    }
  },
};
