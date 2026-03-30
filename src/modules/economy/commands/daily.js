const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");

const DAILY_AMOUNT = 500;
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

function respond(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily casino allowance."),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return respond(interaction, {
          content: "This command only works in servers.",
        });
      }

      const guildId = interaction.guild.id;
      const userId = interaction.user.id;
      const now = new Date();

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

          return respond(interaction, {
            content: `⏳ You already claimed your daily.\nCome back in **${hours}h ${minutes}m**.`,
          });
        }
      }

      const profile = await prisma.$transaction(async (tx) => {
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
        .setTitle("💰 Daily Claimed")
        .setDescription(
          `You received **${DAILY_AMOUNT}** coins.\nYour new balance is **${profile.balance}**.`,
        )
        .setColor(0x3498db)
        .setTimestamp();

      return respond(interaction, {
        embeds: [embed],
      });
    } catch (err) {
      console.error("[daily] error:", err);

      return respond(interaction, {
        content: "❌ Error running /daily.",
      });
    }
  },
};
