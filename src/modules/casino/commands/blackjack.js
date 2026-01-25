// src/modules/casino/commands/blackjack.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { prisma } = require("../../../core/database");

// =============================
// Card / deck helpers
// =============================
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

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  // Fisher–Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardToString(card) {
  return `${card.rank}${card.suit}`;
}

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

function buildButtons(userId, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_hit_${userId}`)
      .setLabel("Hit")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`bj_stand_${userId}`)
      .setLabel("Stand")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
}

function buildEmbed({
  interaction,
  bet,
  playerHand,
  dealerHand,
  finalText,
  finished,
  balance,
}) {
  const playerCards = playerHand.map(cardToString).join("  ");
  const dealerCards = dealerHand.map(cardToString).join("  ");

  const playerTotal = handValue(playerHand);
  const dealerTotal = handValue(dealerHand);

  const descriptionLines = [];

  descriptionLines.push(`**Your Hand:** ${playerCards}  → **${playerTotal}**`);

  if (finished) {
    descriptionLines.push(
      `**Dealer's Hand:** ${dealerCards}  → **${dealerTotal}**`,
    );
  } else {
    // show only first dealer card + hidden card(s)
    const shown = dealerHand[0] ? cardToString(dealerHand[0]) : "❓";
    const hiddenCount = Math.max(dealerHand.length - 1, 1);
    const hidden = "🂠 ".repeat(hiddenCount).trim();
    descriptionLines.push(`**Dealer's Hand:** ${shown}  ${hidden}`);
  }

  if (finalText) {
    descriptionLines.push("\n" + finalText);
  } else {
    descriptionLines.push("\nReact with **Hit** or **Stand**.");
  }

  const embed = new EmbedBuilder()
    .setTitle("🃏 Blackjack")
    .setDescription(descriptionLines.join("\n"))
    .addFields({
      name: "Bet",
      value: `${bet} coins`,
      inline: true,
    })
    .setColor(0x1abc9c)
    .setTimestamp();

  if (typeof balance === "number") {
    embed.addFields({
      name: "New Balance",
      value: `${balance} coins`,
      inline: true,
    });
  }

  embed.setFooter({ text: finished ? "Game finished." : "Hit or Stand?" });

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Play interactive blackjack with the casino balance.")
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

      // Check / create econ profile
      let profile = await getOrCreateProfile(guildId, userId);

      if (profile.balance < bet) {
        return interaction.reply({
          content: "You don't have enough coins for that bet.",
          ephemeral: true,
        });
      }

      // Build initial game state
      const deck = buildDeck();
      const playerHand = [deck.pop(), deck.pop()];
      const dealerHand = [deck.pop(), deck.pop()];

      let gameFinished = false;

      const embed = buildEmbed({
        interaction,
        bet,
        playerHand,
        dealerHand,
        finalText: null,
        finished: false,
      });

      const reply = await interaction.reply({
        embeds: [embed],
        components: [buildButtons(userId, false)],
        fetchReply: true,
      });

      const filter = (i) =>
        i.user.id === userId &&
        i.message.id === reply.id &&
        i.customId.startsWith("bj_");

      const collector = reply.createMessageComponentCollector({
        filter,
        time: 60_000, // 60 seconds
      });

      collector.on("collect", async (buttonInteraction) => {
        try {
          const customId = buttonInteraction.customId;

          if (gameFinished) {
            // Just silently ignore (or you can update with "game finished")
            return buttonInteraction.deferUpdate().catch(() => {});
          }

          const playerTotalBefore = handValue(playerHand);

          if (customId.startsWith("bj_hit_")) {
            // Player hits
            playerHand.push(deck.pop());
            const playerTotal = handValue(playerHand);

            // If bust -> finalize loss
            if (playerTotal > 21) {
              gameFinished = true;

              // Lose bet
              const delta = -bet;
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
                  type: "BLACKJACK_LOSS",
                  amount: delta,
                  note: `Blackjack bust (bet ${bet})`,
                },
              });

              const finalEmbed = buildEmbed({
                interaction,
                bet,
                playerHand,
                dealerHand,
                finalText: `💀 You **bust** with **${playerTotal}**. Dealer wins.\nYou lose \`${bet}\` coins.`,
                finished: true,
                balance: profile.balance,
              });

              await buttonInteraction.update({
                embeds: [finalEmbed],
                components: [buildButtons(userId, true)],
              });

              collector.stop("finished");
              return;
            }

            // Still alive → update embed, keep buttons enabled
            const updatedEmbed = buildEmbed({
              interaction,
              bet,
              playerHand,
              dealerHand,
              finalText: null,
              finished: false,
            });

            await buttonInteraction.update({
              embeds: [updatedEmbed],
              components: [buildButtons(userId, false)],
            });
          } else if (customId.startsWith("bj_stand_")) {
            // Player stands -> dealer plays out, then resolve result
            gameFinished = true;

            let dealerTotal = handValue(dealerHand);

            // Dealer hits until 17 or more
            while (dealerTotal < 17) {
              dealerHand.push(deck.pop());
              dealerTotal = handValue(dealerHand);
            }

            const playerTotal = handValue(playerHand);

            let finalText;
            let delta = 0;
            let txType = null;

            if (dealerTotal > 21) {
              finalText = `😈 Dealer busts with **${dealerTotal}**. You win!`;
              delta = bet;
              txType = "BLACKJACK_WIN";
            } else if (playerTotal > dealerTotal) {
              finalText = `✅ You win with **${playerTotal}** vs dealer's **${dealerTotal}**.`;
              delta = bet;
              txType = "BLACKJACK_WIN";
            } else if (dealerTotal > playerTotal) {
              finalText = `❌ Dealer wins with **${dealerTotal}** vs your **${playerTotal}**.`;
              delta = -bet;
              txType = "BLACKJACK_LOSS";
            } else {
              finalText = `🤝 Push. You both have **${playerTotal}**.\nNo coins change hands.`;
              delta = 0;
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
                  note: `Blackjack stand (bet ${bet})`,
                },
              });
            } else {
              profile = await prisma.economyProfile.findUnique({
                where: {
                  guildId_userId: { guildId, userId },
                },
              });
            }

            const finalEmbed = buildEmbed({
              interaction,
              bet,
              playerHand,
              dealerHand,
              finalText:
                finalText +
                `\n\n**Bet:** ${bet} coins\n**New Balance:** ${profile.balance} coins`,
              finished: true,
              balance: profile.balance,
            });

            await buttonInteraction.update({
              embeds: [finalEmbed],
              components: [buildButtons(userId, true)],
            });

            collector.stop("finished");
          } else {
            // Unknown button
            await buttonInteraction.deferUpdate().catch(() => {});
          }
        } catch (err) {
          console.error("[blackjack] collector error:", err);
          try {
            await buttonInteraction.reply({
              content: "❌ Something went wrong handling that move.",
              ephemeral: true,
            });
          } catch {
            // ignore
          }
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "finished") return;

        // Time out / end -> disable buttons
        try {
          const msg = await interaction.fetchReply().catch(() => null);
          if (!msg) return;

          await msg
            .edit({
              components: [buildButtons(userId, true)],
            })
            .catch(() => {});
        } catch (err) {
          console.error("[blackjack] collector end error:", err);
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
