const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../core/database");
const { postModLog } = require("../modlog");

function clampInt(n, min, max) {
  if (!Number.isFinite(n)) return null;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a user (minutes)")
    .addUserOption((o) =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName("minutes")
        .setDescription("1-40320 (max 28 days)")
        .setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user", true);
    const minutesRaw = interaction.options.getInteger("minutes", true);
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";

    // Discord timeout max = 28 days
    const minutes = clampInt(minutesRaw, 1, 40320);
    if (minutes === null) {
      await interaction.editReply("❌ Invalid minutes value.");
      return;
    }

    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);
    if (!member) {
      await interaction.editReply("❌ That user isn’t in this server.");
      return;
    }

    // Safer: use duration ms instead of a Date
    const durationMs = minutes * 60_000;

    try {
      await member.timeout(durationMs, reason);
    } catch (e) {
      console.error(e);
      await interaction.editReply(
        "❌ Failed to apply timeout. Check the bot role has **Timeout Members** and is higher than the target user’s top role."
      );
      return;
    }

    await prisma.infraction.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        modId: interaction.user.id,
        type: "timeout",
        reason,
        meta: { minutes },
      },
    });

    await postModLog(
      interaction.client,
      interaction.guild.id,
      `⏱️ **Timeout** • <@${user.id}> for **${minutes}m** by <@${interaction.user.id}>\n> ${reason}`
    );

    await interaction.editReply(
      `✅ Timed out <@${user.id}> for **${minutes} minutes**.`
    );
  },
};
