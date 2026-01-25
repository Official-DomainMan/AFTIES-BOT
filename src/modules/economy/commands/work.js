// src/modules/economy/commands/work.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getOrCreateProfile,
  adjustBalanceWithTransaction,
  prisma,
} = require("../economy");

// Cooldown: 30 minutes
const WORK_COOLDOWN_MS = 30 * 60 * 1000;

// Chance of total failure (0 reward)
const FAIL_CHANCE = 0.25;

// Payout range for successful work
const WORK_MIN_REWARD = 120;
const WORK_MAX_REWARD = 280;

function getRandomInt(min, max) {
  const low = Math.ceil(min);
  const high = Math.floor(max);
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function formatMs(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("work")
    .setDescription("Clock in, do a risky job, maybe get paid."),

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

      // Ensure profile exists (creates with 0 balance if needed)
      const profile = await getOrCreateProfile(guildId, userId);

      // Check last WORK transaction for cooldown
      const lastWorkTx = await prisma.economyTransaction.findFirst({
        where: {
          guildId,
          userId,
          type: "WORK",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (lastWorkTx) {
        const diff = now.getTime() - lastWorkTx.createdAt.getTime();
        if (diff < WORK_COOLDOWN_MS) {
          const remaining = WORK_COOLDOWN_MS - diff;
          const embed = new EmbedBuilder()
            .setTitle("⏳ You’re still on break")
            .setDescription(
              `You just worked not too long ago.\n\nYou can clock in again in **${formatMs(
                remaining,
              )}**.`,
            )
            .setColor(0x95a5a6)
            .setFooter({
              text: "Capitalism says rest is illegal, I disagree.",
            });

          return interaction.reply({ embeds: [embed], ephemeral: true });
        }
      }

      // Decide success or failure
      const failed = Math.random() < FAIL_CHANCE;

      // Some flavored scenarios
      const successScenarios = [
        "ran a messy late-night shift at the AFTIES bar",
        "dealt a blackjack table and upsold shots between hands",
        "hosted a deranged roulette side-bet with your friends",
        "worked the door, letting in only the unhinged & beautiful",
        "DJ’d a cursed afters set that somehow went viral",
        "pulled a double shift as casino therapist & menace",
      ];

      const failScenarios = [
        "showed up late, stayed for vibes, clocked 0 hours",
        "spent your whole shift flirting and forgot to actually work",
        "got distracted by slots and never made it to your station",
        "argued with the manager about your worth (you were right)",
        "spent all shift in the smoking section talking shit",
      ];

      const successScenario =
        successScenarios[getRandomInt(0, successScenarios.length - 1)];
      const failScenario =
        failScenarios[getRandomInt(0, failScenarios.length - 1)];

      let reward = 0;
      let description;
      let outcomeLabel;

      if (failed) {
        // 0 reward, no fine
        reward = 0;
        outcomeLabel = "Failed shift (0 pay)";
        description = `You **${failScenario}**.\n\nYou didn’t earn anything this time, but at least the vibes were free.`;
      } else {
        reward = getRandomInt(WORK_MIN_REWARD, WORK_MAX_REWARD);
        outcomeLabel = "Paid shift";
        description = `You **${successScenario}**.\n\nYou got paid **${reward}** 🪙 for your troubles.`;
      }

      // Log + apply reward (0 or positive) via transaction system
      const updatedProfile = await adjustBalanceWithTransaction(
        guildId,
        userId,
        reward,
        "WORK",
        {
          success: !failed,
          scenario: failed ? failScenario : successScenario,
        },
      );

      const embed = new EmbedBuilder()
        .setTitle("💼 Work Summary")
        .setDescription(description)
        .setColor(failed ? 0xe67e22 : 0x2ecc71)
        .addFields(
          {
            name: "Outcome",
            value: failed ? "❌ No payout this time" : "✅ Shift completed",
            inline: true,
          },
          {
            name: "Pay",
            value: failed ? "0 🪙" : `${reward} 🪙`,
            inline: true,
          },
          {
            name: "New Balance",
            value: `${updatedProfile.balance} 🪙`,
            inline: false,
          },
        )
        .setFooter({
          text: failed
            ? "Try again after cooldown. Hustle isn’t linear."
            : "Keep clocking in, menace.",
        })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[work] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /work.",
          ephemeral: true,
        });
      }
    }
  },
};
