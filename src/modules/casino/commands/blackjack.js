// src/modules/casino/commands/blackjack.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { prisma } = require("../../../core/database");

// ---------- Card helpers ----------

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [
  { label: "A", value: 11 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6", value: 6 },
  { label: "7", value: 7 },
  { label: "8", value: 8 },
  { label: "9", value: 9 },
  { label: "10", value: 10 },
  { label: "J", value: 10 },
  { label: "Q", value: 10 },
  { label: "K", value: 10 },
];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        label: `${rank.label}${suit}`,
        value: rank.value,
        isAce: rank.label === "A",
      });
    }
  }
  // shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function drawCard(deck) {
  return deck.pop();
}

function calculateHandValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    total += card.value;
    if (card.isAce) aces++;
  }

  // Downgrade Aces from 11 to 1 if we bust
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function formatHand(hand) {
  return hand.map((c) => `\`${c.label}\``).join(" ");
}

// Economy helpers (local to avoid relying on earlier helpers)
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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Play blackjack in the AFTIES casino.")
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

      // Economy checks
      let wallet = await getOrCreateWallet(guildId, userId);
      if (wallet.balance < bet) {
        return interaction.reply({
          content: `❌ You don't have enough coins to bet \`${bet}\`. Your balance is \`${wallet.balance}\`.`,
          ephemeral: true,
        });
      }

      // Take the bet up-front
      wallet = await adjustBalance(guildId, userId, -bet);

      const deck = createDeck();
      const playerHand = [drawCard(deck), drawCard(deck)];
      const dealerHand = [drawCard(deck), drawCard(deck)];

      let playerValue = calculateHandValue(playerHand);
      let dealerValue = calculateHandValue(dealerHand);

      let gameOver = false;
      let resultText = null;
      let netChange = -bet; // default assume loss until proven otherwise

      const hitButton = new ButtonBuilder()
        .setCustomId("bj_hit")
        .setLabel("Hit")
        .setStyle(ButtonStyle.Primary);

      const standButton = new ButtonBuilder()
        .setCustomId("bj_stand")
        .setLabel("Stand")
        .setStyle(ButtonStyle.Secondary);

      function makeRow(disabled = false) {
        return new ActionRowBuilder().addComponents(
          hitButton.setDisabled(disabled),
          standButton.setDisabled(disabled),
        );
      }

      function makeEmbed(showDealerHole = false) {
        const dealerShownCards = showDealerHole
          ? formatHand(dealerHand)
          : `${dealerHand[0] ? `\`${dealerHand[0].label}\`` : "?"} \`??\``;

        const dealerShownValue = showDealerHole ? dealerValue : "??";

        const embed = new EmbedBuilder()
          .setTitle("🃏 Blackjack")
          .setColor(0x2c3e50)
          .setDescription(
            [
              `**Bet:** \`${bet}\`  •  **Balance:** \`${wallet.balance}\``,
              "",
              `**Dealer**: ${dealerShownCards}`,
              `Value: \`${dealerShownValue}\``,
              "",
              `**You**: ${formatHand(playerHand)}`,
              `Value: \`${playerValue}\``,
            ].join("\n"),
          )
          .setFooter({ text: "AFTIES Casino — Hit or Stand." })
          .setTimestamp();

        if (gameOver && resultText) {
          embed.addFields({
            name: "Result",
            value: resultText,
          });
        }

        return embed;
      }

      // Immediate blackjack check
      const initialPlayerBJ = playerValue === 21;
      const initialDealerBJ = dealerValue === 21;

      if (initialPlayerBJ || initialDealerBJ) {
        // Reveal dealer hand
        gameOver = true;

        if (initialPlayerBJ && !initialDealerBJ) {
          // Pay 2.5x (net +1.5x)
          const payout = Math.floor(bet * 2.5);
          wallet = await adjustBalance(guildId, userId, payout);
          netChange = payout - bet;
          resultText = `🖤 **Blackjack!** You win \`${payout}\` (net +\`${netChange}\`). New balance: \`${wallet.balance}\`.`;
        } else if (!initialPlayerBJ && initialDealerBJ) {
          // Lose, we already took bet
          resultText = `💀 Dealer has blackjack. You lose your bet of \`${bet}\`. New balance: \`${wallet.balance}\`.`;
        } else {
          // Both blackjack -> push
          wallet = await adjustBalance(guildId, userId, bet);
          netChange = 0;
          resultText = `⚖️ Both you and the dealer have blackjack. It's a push. Your bet of \`${bet}\` is returned. Balance: \`${wallet.balance}\`.`;
        }

        return interaction.reply({
          embeds: [makeEmbed(true)],
          components: [makeRow(true)],
        });
      }

      // Send initial message and set up buttons
      const reply = await interaction.reply({
        embeds: [makeEmbed(false)],
        components: [makeRow(false)],
        fetchReply: true,
      });

      const collector = reply.createMessageComponentCollector({
        time: 60_000,
        filter: (i) => i.user.id === userId,
      });

      collector.on("collect", async (i) => {
        try {
          if (i.customId === "bj_hit") {
            playerHand.push(drawCard(deck));
            playerValue = calculateHandValue(playerHand);

            if (playerValue > 21) {
              // Bust
              gameOver = true;
              resultText = `💥 You bust with \`${playerValue}\`. You lose your bet of \`${bet}\`. New balance: \`${wallet.balance}\`.`;
              collector.stop("bust");
              await i.update({
                embeds: [makeEmbed(true)],
                components: [makeRow(true)],
              });
              return;
            }

            // Still alive, update hand
            await i.update({
              embeds: [makeEmbed(false)],
              components: [makeRow(false)],
            });
          } else if (i.customId === "bj_stand") {
            // Dealer draws until 17+
            while (dealerValue < 17) {
              dealerHand.push(drawCard(deck));
              dealerValue = calculateHandValue(dealerHand);
            }

            gameOver = true;

            if (dealerValue > 21 || playerValue > dealerValue) {
              // Player win (non-blackjack)
              const payout = bet * 2; // original bet + winnings
              wallet = await adjustBalance(guildId, userId, payout);
              netChange = bet;
              resultText = `✅ You win! Your \`${playerValue}\` beats dealer's \`${dealerValue}\`. You receive \`${payout}\` (net +\`${netChange}\`). New balance: \`${wallet.balance}\`.`;
            } else if (dealerValue === playerValue) {
              // Push
              wallet = await adjustBalance(guildId, userId, bet);
              netChange = 0;
              resultText = `⚖️ Push. Both you and the dealer have \`${playerValue}\`. Your bet of \`${bet}\` is returned. Balance: \`${wallet.balance}\`.`;
            } else {
              // Dealer win
              resultText = `❌ Dealer wins with \`${dealerValue}\` vs your \`${playerValue}\`. You lose your bet of \`${bet}\`. Balance: \`${wallet.balance}\`.`;
            }

            collector.stop("stand");
            await i.update({
              embeds: [makeEmbed(true)],
              components: [makeRow(true)],
            });
          }
        } catch (err) {
          console.error("[blackjack] collector error:", err);
          if (!i.replied && !i.deferred) {
            await i.reply({
              content: "❌ Something went wrong with the blackjack game.",
              ephemeral: true,
            });
          }
        }
      });

      collector.on("end", async (collected, reason) => {
        if (gameOver) return;
        // Time out – mark as expired but do NOT refund (house wins on AFK)
        gameOver = true;
        resultText = `⌛ Game timed out. You forfeited your bet of \`${bet}\`. Balance: \`${wallet.balance}\`.`;

        try {
          await reply.edit({
            embeds: [makeEmbed(true)],
            components: [makeRow(true)],
          });
        } catch {
          // ignore edit errors
        }
      });
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
