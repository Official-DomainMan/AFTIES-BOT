// src/modules/casino/commands/blackjack.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

// Card definitions using emojis as "pictures"
const SUITS = ["♠️", "♥️", "♦️", "♣️"];
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

// Build and shuffle deck
function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Convert card to emoji-ish string
function cardToString(card) {
  return `${card.rank}${card.suit}`;
}

// Calculate hand total with Ace logic
function handValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    if (card.rank === "A") {
      total += 11;
      aces += 1;
    } else if (["K", "Q", "J"].includes(card.rank)) {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }

  // Downgrade Aces from 11 to 1 if needed
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Play a round of blackjack.")
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

      // Ensure econ profile & balance
      let profile = await getOrCreateProfile(guildId, userId);
      if (profile.balance < bet) {
        return interaction.reply({
          content: "You don't have enough coins for that bet.",
          ephemeral: true,
        });
      }

      // Build game state
      const deck = buildDeck();
      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];

      let playerTotal = handValue(playerHand);
      let dealerTotal = handValue(dealerHand);

      // Very simple auto-play:
      // - Player "hits" until 16 or more
      // - Dealer hits until 17 or more
      while (playerTotal < 16) {
        playerHand.push(deck.pop());
        playerTotal = handValue(playerHand);
      }

      if (playerTotal <= 21) {
        while (dealerTotal < 17) {
          dealerHand.push(deck.pop());
          dealerTotal = handValue(dealerHand);
        }
      }

      let resultText;
      let delta = 0;
      let txType = null;

      if (playerTotal > 21) {
        // Player bust
        resultText = `💀 You bust with **${playerTotal}**. Dealer wins.`;
        delta = -bet;
        txType = "BLACKJACK_LOSS";
      } else if (dealerTotal > 21) {
        resultText = `😈 Dealer busts with **${dealerTotal}**. You win!`;
        delta = bet; // net +bet
        txType = "BLACKJACK_WIN";
      } else if (playerTotal > dealerTotal) {
        resultText = `✅ You win with **${playerTotal}** vs dealer's **${dealerTotal}**.`;
        delta = bet;
        txType = "BLACKJACK_WIN";
      } else if (dealerTotal > playerTotal) {
        resultText = `❌ Dealer wins with **${dealerTotal}** vs your **${playerTotal}**.`;
        delta = -bet;
        txType = "BLACKJACK_LOSS";
      } else {
        resultText = `🤝 Push. You both have **${playerTotal}**. No coins change hands.`;
        delta = 0;
      }

      // Apply balance + log transaction (if delta != 0)
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
            note: `Blackjack bet ${bet}`,
          },
        });
      } else {
        // Refresh profile to show correct balance
        profile = await prisma.economyProfile.findUnique({
          where: {
            guildId_userId: { guildId, userId },
          },
        });
      }

      const playerCards = playerHand.map(cardToString).join("  ");
      const dealerCards = dealerHand.map(cardToString).join("  ");

      const embed = new EmbedBuilder()
        .setTitle("🃏 Blackjack")
        .setDescription(resultText)
        .addFields(
          {
            name: "Your Hand",
            value: `${playerCards}\n**Total:** ${playerTotal}`,
            inline: false,
          },
          {
            name: "Dealer's Hand",
            value: `${dealerCards}\n**Total:** ${dealerTotal}`,
            inline: false,
          },
          {
            name: "Bet",
            value: `${bet} coins`,
            inline: true,
          },
          {
            name: "New Balance",
            value: `${profile.balance} coins`,
            inline: true,
          },
        )
        .setColor(0x1abc9c)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[blackjack] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /blackjack.",
          ephemeral: true,
        });
      }
    }
  },
};
