const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { prisma } = require("../../../core/database");
const { postModLog } = require("../modlog");
const { getPolicy } = require("../policy");

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} minute(s)`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hour(s)`;
  return `${hours} hour(s) ${mins} minute(s)`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a user (decay + auto-timeout)")
    .addUserOption((o) =>
      o.setName("user").setDescription("User to warn").setRequired(true),
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const user = interaction.options.getUser("user", true);
      const reason =
        interaction.options.getString("reason")?.trim() || "No reason provided";
      const guild = interaction.guild;
      const guildId = guild.id;

      if (user.bot) {
        return interaction.editReply({ content: "❌ You cannot warn a bot." });
      }

      if (user.id === interaction.user.id) {
        return interaction.editReply({
          content: "❌ You cannot warn yourself.",
        });
      }

      if (user.id === interaction.client.user.id) {
        return interaction.editReply({ content: "❌ Nice try." });
      }

      const member = await guild.members.fetch(user.id).catch(() => null);
      const moderatorMember = await guild.members
        .fetch(interaction.user.id)
        .catch(() => null);
      const botMember =
        guild.members.me ?? (await guild.members.fetchMe().catch(() => null));

      if (member) {
        if (member.id === guild.ownerId) {
          return interaction.editReply({
            content: "❌ You cannot warn the server owner.",
          });
        }

        if (
          moderatorMember &&
          interaction.user.id !== guild.ownerId &&
          member.roles.highest.position >=
            moderatorMember.roles.highest.position
        ) {
          return interaction.editReply({
            content:
              "❌ You cannot warn a user with an equal or higher role than yours.",
          });
        }

        if (
          botMember &&
          member.roles.highest.position >= botMember.roles.highest.position
        ) {
          return interaction.editReply({
            content:
              "❌ I cannot warn that user because their top role is equal to or higher than mine.",
          });
        }
      }

      const policy = await getPolicy(guildId);
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + policy.warnExpiresDays * 24 * 60 * 60 * 1000,
      );
      const windowStart = new Date(
        now.getTime() - policy.warnWindowDays * 24 * 60 * 60 * 1000,
      );

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

      const warnCase = await prisma.modCase.create({
        data: {
          guildId,
          infractionId: inf.id,
          targetUserId: user.id,
          actorUserId: interaction.user.id,
          type: "warn",
          reason,
          status: "open",
        },
      });

      const activeWarns = await prisma.infraction.count({
        where: {
          guildId,
          userId: user.id,
          type: "warn",
          createdAt: { gte: windowStart },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });

      let dmWarnStatus = "Not attempted";
      let dmTimeoutStatus = "Not attempted";
      let autoActionText = "";
      let timeoutApplied = false;
      let timeoutCaseId = null;

      if (policy.dmOnWarn) {
        try {
          const warnEmbed = new EmbedBuilder()
            .setTitle(`⚠️ You were warned in ${guild.name}`)
            .setDescription("A moderator issued you a warning.")
            .addFields(
              { name: "Reason", value: reason },
              { name: "Warning ID", value: `\`${inf.id}\``, inline: true },
              { name: "Case ID", value: `\`${warnCase.id}\``, inline: true },
              { name: "Active Warns", value: `${activeWarns}`, inline: true },
              {
                name: "Warn Expires In",
                value: `${policy.warnExpiresDays} day(s)`,
                inline: true,
              },
            )
            .setFooter({
              text: "Please review the server rules and avoid further moderation action.",
            })
            .setTimestamp();

          await user.send({ embeds: [warnEmbed] });
          dmWarnStatus = "Sent";
        } catch (error) {
          dmWarnStatus = "Failed";
          console.error("[warn:dm]", error);
        }
      }

      await postModLog(
        interaction.client,
        guildId,
        [
          `⚠️ **Warn** • <@${user.id}> by <@${interaction.user.id}>`,
          `• infraction: \`${inf.id}\``,
          `• case: \`${warnCase.id}\``,
          `> ${reason}`,
          `• active warns in ${policy.warnWindowDays}d: **${activeWarns}**`,
          `• expires: <t:${Math.floor(expiresAt.getTime() / 1000)}:F>`,
          `• DM: **${policy.dmOnWarn ? dmWarnStatus : "Disabled"}**`,
        ].join("\n"),
      );

      if (activeWarns >= policy.autoTimeoutWarnCount) {
        if (member) {
          const minutes = policy.autoTimeoutMinutes;
          const durationMs = minutes * 60_000;

          try {
            await member.timeout(
              durationMs,
              `Auto-timeout: ${activeWarns} warns in ${policy.warnWindowDays}d`,
            );

            const timeoutInf = await prisma.infraction.create({
              data: {
                guildId,
                userId: user.id,
                modId: interaction.client.user.id,
                type: "timeout",
                reason: `Auto-timeout: ${activeWarns} warns in ${policy.warnWindowDays}d`,
                meta: {
                  minutes,
                  triggerWarnId: inf.id,
                  activeWarns,
                },
              },
            });

            const timeoutCase = await prisma.modCase.create({
              data: {
                guildId,
                infractionId: timeoutInf.id,
                targetUserId: user.id,
                actorUserId: interaction.client.user.id,
                type: "timeout",
                reason: `Auto-timeout: ${activeWarns} warns in ${policy.warnWindowDays}d`,
                status: "open",
              },
            });

            timeoutCaseId = timeoutCase.id;
            timeoutApplied = true;
            autoActionText = `⛔ Auto-timeout applied: **${minutes} minutes** (active warns: **${activeWarns}**).`;

            if (policy.dmOnAutoTimeout) {
              try {
                const timeoutEmbed = new EmbedBuilder()
                  .setTitle(`⏱️ You were timed out in ${guild.name}`)
                  .setDescription(
                    "This was triggered automatically by the server warn policy.",
                  )
                  .addFields(
                    {
                      name: "Duration",
                      value: formatDuration(minutes),
                      inline: true,
                    },
                    {
                      name: "Trigger",
                      value: `${activeWarns} active warn(s) in ${policy.warnWindowDays} day(s)`,
                      inline: true,
                    },
                    {
                      name: "Related Warn Case",
                      value: `\`${warnCase.id}\``,
                      inline: true,
                    },
                    {
                      name: "Timeout Case",
                      value: `\`${timeoutCase.id}\``,
                      inline: true,
                    },
                    {
                      name: "Reason",
                      value: reason,
                    },
                  )
                  .setTimestamp();

                await user.send({ embeds: [timeoutEmbed] });
                dmTimeoutStatus = "Sent";
              } catch (error) {
                dmTimeoutStatus = "Failed";
                console.error("[warn:auto-timeout-dm]", error);
              }
            }

            await postModLog(
              interaction.client,
              guildId,
              [
                `⛔ **Auto-timeout** • <@${user.id}> for **${minutes}m**`,
                `• case: \`${timeoutCase.id}\``,
                `> Triggered by **${activeWarns}** active warns in **${policy.warnWindowDays}d**`,
                `• DM: **${policy.dmOnAutoTimeout ? dmTimeoutStatus : "Disabled"}**`,
              ].join("\n"),
            );
          } catch (error) {
            console.error("[warn:auto-timeout]", error);
            autoActionText =
              "⚠️ Auto-timeout triggered but failed (likely role hierarchy or missing Timeout Members permission).";
          }
        } else {
          autoActionText =
            "ℹ️ Auto-timeout would trigger, but that user is not currently in this server.";
        }
      }

      const replyEmbed = new EmbedBuilder()
        .setTitle("✅ User warned")
        .addFields(
          { name: "User", value: `<@${user.id}>`, inline: true },
          { name: "Warning ID", value: `\`${inf.id}\``, inline: true },
          { name: "Case ID", value: `\`${warnCase.id}\``, inline: true },
          { name: "Active Warns", value: `${activeWarns}`, inline: true },
          { name: "Reason", value: reason },
          {
            name: "Warn DM",
            value: policy.dmOnWarn ? dmWarnStatus : "Disabled by policy",
            inline: true,
          },
          {
            name: "Auto-timeout",
            value: timeoutApplied
              ? `${policy.autoTimeoutMinutes} minute(s)`
              : "Not triggered",
            inline: true,
          },
          {
            name: "Auto-timeout Case",
            value: timeoutCaseId ? `\`${timeoutCaseId}\`` : "Not applicable",
            inline: true,
          },
          {
            name: "Auto-timeout DM",
            value: timeoutApplied
              ? policy.dmOnAutoTimeout
                ? dmTimeoutStatus
                : "Disabled by policy"
              : "Not applicable",
            inline: true,
          },
        )
        .setTimestamp();

      return interaction.editReply({
        content: autoActionText || undefined,
        embeds: [replyEmbed],
      });
    } catch (error) {
      console.error("[/warn]", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Something went wrong while running `/warn`.",
        });
      }

      return interaction.reply({
        content: "❌ Something went wrong while running `/warn`.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
