// src/modules/economy/commands/daily.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

const DAILY_AMOUNT = 500;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily casino allowance."),

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
      const now = new Date();

      // 🔍 find last DAILY transaction for cooldown
      const lastDaily = await prisma.economyTransaction.findFirst({
        where: {
          guildId,
          userId,
          type: "DAILY",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (lastDaily) {
        const diff = now.getTime() - new Date(lastDaily.createdAt).getTime();
        if (diff < DAILY_COOLDOWN_MS) {
          const remainingMs = DAILY_COOLDOWN_MS - diff;
          const hours = Math.floor(remainingMs / (60 * 60 * 1000));
          const minutes = Math.floor(
            (remainingMs % (60 * 60 * 1000)) / (60 * 1000),
          );

          return interaction.reply({
            content: `⏳ You already claimed your daily. Come back in **${hours}h ${minutes}m**.`,
            ephemeral: true,
          });
        }
      }

      // 💰 award + log transaction atomically
      const profile = await prisma.$transaction(async (tx) => {
        // ensure profile exists
        let econ = await tx.economyProfile.findUnique({
          where: {
            guildId_userId: {
              guildId,
              userId,
            },
          },
        });

        if (!econ) {
          econ = await tx.economyProfile.create({
            data: {
              guildId,
              userId,
              balance: 0,
            },
          });
        }

        // update balance
        const updated = await tx.economyProfile.update({
          where: {
            guildId_userId: {
              guildId,
              userId,
            },
          },
          data: {
            balance: {
              increment: DAILY_AMOUNT,
            },
          },
        });

        // log transaction
        await tx.economyTransaction.create({
          data: {
            guildId,
            userId,
            type: "DAILY",
            amount: DAILY_AMOUNT,
            note: "Daily claim",
          },
        });

        return updated;
      });

      const embed = new EmbedBuilder()
        .setTitle("🎁 Daily Claimed")
        .setDescription(
          `You received **${DAILY_AMOUNT}** coins.\n` +
            `Your new balance is **${profile.balance}**.`,
        )
        .setColor(0x3498db)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error("[daily] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /daily.",
          ephemeral: true,
        });
      }
    }
  },
};
