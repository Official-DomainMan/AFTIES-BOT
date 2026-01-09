const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../core/database");
const { postModLog } = require("../modlog");
const { getPolicy } = require("../policy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user (decay + auto-timeout)")
    .addUserOption((o) =>
      o.setName("user").setDescription("User to warn").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user", true);
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";
    const guildId = interaction.guild.id;

    const policy = await getPolicy(guildId);
    const now = new Date();

    const expiresAt = new Date(
      now.getTime() + policy.warnExpiresDays * 24 * 60 * 60 * 1000
    );
    const windowStart = new Date(
      now.getTime() - policy.warnWindowDays * 24 * 60 * 60 * 1000
    );

    // 1) Create warn record
    const inf = await prisma.infraction.create({
      data: {
        guildId,
        userId: user.id,
        modId: interaction.user.id,
        type: "warn",
        reason,
        expiresAt,
      },
    });

    // 2) DM on warn (if enabled)
    if (policy.dmOnWarn) {
      try {
        await user.send({
          content: [
            `⚠️ You received a warning in **${interaction.guild.name}**.`,
            ``,
            `Reason: ${reason}`,
            `This may expire in **${policy.warnExpiresDays} day(s)** depending on server policy.`,
          ].join("\n"),
        });
      } catch {
        // ignore if DMs are closed
      }
    }

    // 3) Log to modlog
    await postModLog(
      interaction.client,
      guildId,
      `⚠️ **Warn** • <@${user.id}> by <@${interaction.user.id}> • \`${
        inf.id
      }\`\n> ${reason}\n• expires <t:${Math.floor(
        expiresAt.getTime() / 1000
      )}:R>`
    );

    // 4) Count active warns in the window
    const activeWarns = await prisma.infraction.count({
      where: {
        guildId,
        userId: user.id,
        type: "warn",
        createdAt: { gte: windowStart },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });

    let autoActionText = "";

    if (activeWarns >= policy.autoTimeoutWarnCount) {
      const member = await interaction.guild.members
        .fetch(user.id)
        .catch(() => null);

      if (member) {
        const minutes = policy.autoTimeoutMinutes;
        const durationMs = minutes * 60_000;

        try {
          await member.timeout(
            durationMs,
            `Auto-timeout: ${activeWarns} warns in ${policy.warnWindowDays}d`
          );

          await prisma.infraction.create({
            data: {
              guildId,
              userId: user.id,
              modId: interaction.client.user.id, // system
              type: "timeout",
              reason: `Auto-timeout: ${activeWarns} warns in ${policy.warnWindowDays}d`,
              meta: { minutes, triggerWarnId: inf.id, activeWarns },
            },
          });

          // DM on auto-timeout (if enabled)
          if (policy.dmOnAutoTimeout) {
            try {
              await user.send({
                content: [
                  `⏱️ You have been temporarily timed out in **${interaction.guild.name}**.`,
                  ``,
                  `Duration: **${minutes} minutes**`,
                  `Reason: Reaching **${activeWarns} active warns** within **${policy.warnWindowDays} day(s)**.`,
                ].join("\n"),
              });
            } catch {
              // ignore
            }
          }

          await postModLog(
            interaction.client,
            guildId,
            `⛔ **Auto-timeout** • <@${user.id}> for **${minutes}m**\n> Triggered by **${activeWarns}** active warns in **${policy.warnWindowDays}d**`
          );

          autoActionText = `\n⛔ Auto-timeout applied: **${minutes} minutes** (active warns: **${activeWarns}**).`;
        } catch (e) {
          console.error(e);
          autoActionText =
            "\n⚠️ Auto-timeout triggered but failed (likely role hierarchy or missing Timeout Members).";
        }
      } else {
        autoActionText =
          "\nℹ️ Auto-timeout would trigger, but user is not a member of this server.";
      }
    }

    await interaction.editReply(
      `✅ Warned <@${user.id}>. (id: \`${inf.id}\`)${autoActionText}`
    );
  },
};
