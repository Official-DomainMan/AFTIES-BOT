// src/modules/economy/commands/pay.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Gift casino balance to another user.")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Who do you want to pay?")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("How much do you want to send?")
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
      const fromUser = interaction.user;
      const toUser = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);

      // Basic validation
      if (toUser.bot) {
        return interaction.reply({
          content: "You can't pay bots, babe.",
          ephemeral: true,
        });
      }

      if (toUser.id === fromUser.id) {
        return interaction.reply({
          content: "You can't pay yourself. Nice try though.",
          ephemeral: true,
        });
      }

      if (amount <= 0) {
        return interaction.reply({
          content: "Amount must be greater than 0.",
          ephemeral: true,
        });
      }

      let updatedFrom;
      let updatedTo;

      try {
        const result = await prisma.$transaction(async (tx) => {
          const fromProfile = await tx.economyProfile.findUnique({
            where: {
              guildId_userId: {
                guildId,
                userId: fromUser.id,
              },
            },
          });

          if (!fromProfile || fromProfile.balance < amount) {
            const err = new Error("INSUFFICIENT_FUNDS");
            throw err;
          }

          // decrement sender
          const newFrom = await tx.economyProfile.update({
            where: {
              guildId_userId: {
                guildId,
                userId: fromUser.id,
              },
            },
            data: {
              balance: {
                decrement: amount,
              },
            },
          });

          // increment receiver (upsert profile if needed)
          const newTo = await tx.economyProfile.upsert({
            where: {
              guildId_userId: {
                guildId,
                userId: toUser.id,
              },
            },
            create: {
              guildId,
              userId: toUser.id,
              balance: amount,
            },
            update: {
              balance: {
                increment: amount,
              },
            },
          });

          // log sender transaction (negative)
          await tx.economyTransaction.create({
            data: {
              guildId,
              userId: fromUser.id,
              type: "PAY_SENT",
              amount: -amount,
              note: `To ${toUser.username}`,
            },
          });

          // log receiver transaction (positive)
          await tx.economyTransaction.create({
            data: {
              guildId,
              userId: toUser.id,
              type: "PAY_RECEIVED",
              amount: amount,
              note: `From ${fromUser.username}`,
            },
          });

          return { newFrom, newTo };
        });

        updatedFrom = result.newFrom;
        updatedTo = result.newTo;
      } catch (err) {
        if (err && err.message === "INSUFFICIENT_FUNDS") {
          return interaction.reply({
            content: "You don't have enough balance to do that.",
            ephemeral: true,
          });
        }
        throw err;
      }

      const embed = new EmbedBuilder()
        .setTitle("💸 Payment Sent")
        .setDescription(
          `${fromUser} sent **${amount}** coins to ${toUser}.\n\n` +
            `• Your new balance: **${updatedFrom.balance}**\n` +
            `• ${toUser.username}'s new balance: **${updatedTo.balance}**`,
        )
        .setColor(0x2ecc71)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[pay] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /pay.",
          ephemeral: true,
        });
      }
    }
  },
};
