const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { prisma } = require("../../../core/database");

function toUnix(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

function truncate(text, max = 140) {
  if (!text) return "No reason provided";
  const str = String(text).trim();
  if (str.length <= max) return str;
  return `${str.slice(0, max - 3)}...`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("modhistory")
    .setDescription("View a user's moderation history in one place")
    .addUserOption((o) =>
      o.setName("user").setDescription("User to inspect").setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName("limit")
        .setDescription("How many entries to show per section (default: 5)")
        .setMinValue(1)
        .setMaxValue(15)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const guildId = interaction.guild.id;
      const user = interaction.options.getUser("user", true);
      const limit = interaction.options.getInteger("limit") ?? 5;
      const now = new Date();

      const [allInfractions, recentCases, recentAppeals, recentCaseNotes] =
        await Promise.all([
          prisma.infraction.findMany({
            where: {
              guildId,
              userId: user.id,
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.modCase.findMany({
            where: {
              guildId,
              targetUserId: user.id,
            },
            orderBy: { createdAt: "desc" },
            take: limit,
          }),
          prisma.appeal.findMany({
            where: {
              guildId,
              userId: user.id,
            },
            orderBy: { createdAt: "desc" },
            take: limit,
          }),
          prisma.caseNote.findMany({
            where: {
              guildId,
              case: {
                targetUserId: user.id,
              },
            },
            include: {
              case: true,
            },
            orderBy: { createdAt: "desc" },
            take: limit,
          }),
        ]);

      const warns = allInfractions.filter((i) => i.type === "warn");
      const activeWarns = warns.filter(
        (w) => !w.expiresAt || new Date(w.expiresAt) > now,
      );
      const notes = allInfractions.filter((i) => i.type === "note");
      const timeouts = allInfractions.filter((i) => i.type === "timeout");
      const otherInfractions = allInfractions.filter(
        (i) => !["warn", "note", "timeout"].includes(i.type),
      );

      const recentInfractions = allInfractions.slice(0, limit);

      const embed = new EmbedBuilder()
        .setTitle(`📚 Moderation history for ${user.tag ?? user.username}`)
        .setDescription(`User: <@${user.id}> (\`${user.id}\`)`)
        .addFields({
          name: "Overview",
          value: [
            `• active warns: **${activeWarns.length}**`,
            `• total warns: **${warns.length}**`,
            `• total timeouts: **${timeouts.length}**`,
            `• total notes: **${notes.length}**`,
            `• other infractions: **${otherInfractions.length}**`,
            `• total cases: **${recentCases.length > 0 ? "see below" : "0 recent"}**`,
            `• total appeals: **${recentAppeals.length} recent**`,
          ].join("\n"),
          inline: false,
        })
        .setTimestamp();

      if (recentInfractions.length > 0) {
        embed.addFields({
          name: "Recent Infractions",
          value: recentInfractions
            .map((inf) => {
              const bits = [
                `• \`${inf.id}\` — **${inf.type}**`,
                `• by: <@${inf.modId}>`,
                `• created: <t:${toUnix(inf.createdAt)}:R>`,
              ];

              if (inf.type === "warn") {
                const status =
                  inf.expiresAt && new Date(inf.expiresAt) <= now
                    ? "expired"
                    : "active";
                bits.push(`• warn status: **${status}**`);
              }

              if (inf.expiresAt) {
                bits.push(`• expires: <t:${toUnix(inf.expiresAt)}:R>`);
              }

              bits.push(`• reason: ${truncate(inf.reason, 110)}`);

              return bits.join("\n");
            })
            .join("\n\n")
            .slice(0, 1024),
        });
      }

      if (recentCases.length > 0) {
        embed.addFields({
          name: "Recent Cases",
          value: recentCases
            .map((row) =>
              [
                `• \`${row.id}\` — **${row.type}** / **${row.status}**`,
                `• actor: <@${row.actorUserId}>`,
                `• created: <t:${toUnix(row.createdAt)}:R>`,
                `• linked infraction: ${row.infractionId ? `\`${row.infractionId}\`` : "none"}`,
                `• reason: ${truncate(row.reason, 100)}`,
              ].join("\n"),
            )
            .join("\n\n")
            .slice(0, 1024),
        });
      }

      if (recentCaseNotes.length > 0) {
        embed.addFields({
          name: "Recent Case Notes",
          value: recentCaseNotes
            .map((n) =>
              [
                `• \`${n.id}\` on case \`${n.caseId}\``,
                `• by: <@${n.authorId}>`,
                `• created: <t:${toUnix(n.createdAt)}:R>`,
                `• note: ${truncate(n.note, 100)}`,
              ].join("\n"),
            )
            .join("\n\n")
            .slice(0, 1024),
        });
      }

      if (recentAppeals.length > 0) {
        embed.addFields({
          name: "Recent Appeals",
          value: recentAppeals
            .map((a) =>
              [
                `• \`${a.id}\` — case \`${a.caseId}\` — **${a.status}**`,
                `• created: <t:${toUnix(a.createdAt)}:R>`,
                `• reviewed by: ${
                  a.reviewedById ? `<@${a.reviewedById}>` : "not reviewed"
                }`,
                `• reason: ${truncate(a.reason, 90)}`,
                `• review note: ${truncate(a.reviewNote, 90)}`,
              ].join("\n"),
            )
            .join("\n\n")
            .slice(0, 1024),
        });
      }

      if (
        recentInfractions.length === 0 &&
        recentCases.length === 0 &&
        recentCaseNotes.length === 0 &&
        recentAppeals.length === 0
      ) {
        embed.setDescription(
          `User: <@${user.id}> (\`${user.id}\`)\n\nNo moderation history found for this user.`,
        );
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("[/modhistory]", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Something went wrong while running `/modhistory`.",
        });
      }

      return interaction.reply({
        content: "❌ Something went wrong while running `/modhistory`.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
