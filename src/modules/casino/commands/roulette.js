// src/modules/casino/commands/roulette.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

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

function spinWheel() {
  // Return number 0-36 + inferred color
  const n = Math.floor(Math.random() * 37); // 0 to 36
  let color;
  if (n === 0) color = "green";
  else if (n % 2 === 0) color = "red";
  else color = "black";

  return { number: n, color };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("roulette")
    .setDescription("Spin the wheel (red/black/green).")
    .addIntegerOption((opt) =>
      opt
        .setName("bet")
        .setDescription("How much to bet.")
        .setRequired(true)
        .setMinValue(1),
    )
    .addStringOption((opt) =>
      opt
        .setName("choice")
        .setDescription("Bet on a color.")
        .setRequired(true)
        .addChoices(
          { name: "Red (2x)", value: "red" },
          { name: "Black (2x)", value: "black" },
          { name: "Green (14x)", value: "green" },
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

      const bet = interaction.options.getInteger("bet", true);
      const choice = interaction.options.getString("choice", true); // red/black/green
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

      const { number, color } = spinWheel();

      let payout = 0;
      let netChange = -bet;
      let flavor = "";

      if (choice === color) {
        if (color === "green") {
          payout = bet * 14;
          flavor = "💚 You hit **GREEN**. Disgusting luck.";
        } else {
          payout = bet * 2; // standard color win
          flavor = `✅ You guessed **${color.toUpperCase()}** right.`;
        }
        wallet = await adjustBalance(guildId, userId, payout);
        netChange = payout - bet;
      } else {
        flavor = `❌ You picked **${choice.toUpperCase()}**, wheel landed on **${color.toUpperCase()}**.`;
      }

      const colorEmoji =
        color === "red" ? "🔴" : color === "black" ? "⚫" : "🟢";

      const embed = new EmbedBuilder()
        .setTitle("🎡 Roulette")
        .setColor(
          color === "green" ? 0x2ecc71 : color === "red" ? 0xe74c3c : 0x000000,
        )
        .setDescription(
          [
            `**Wheel:** ${colorEmoji} Number \`${number}\` (${color.toUpperCase()})`,
            "",
            flavor,
            "",
            `**Bet:** \`${bet}\` on \`${choice.toUpperCase()}\``,
            `**Payout:** \`${payout}\``,
            `**Net:** \`${netChange >= 0 ? "+" : ""}${netChange}\``,
            `**Balance:** \`${wallet.balance}\``,
          ].join("\n"),
        )
        .setFooter({ text: "AFTIES Roulette — may the odds clown you." })
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
