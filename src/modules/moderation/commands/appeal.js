const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { prisma } = require("../../../core/database");

function isMod(interaction) {
  return (
    interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("appeal")
    .setDescription("Submit or review moderation appeals")
    .addSubcommand((sc) =>
      sc
        .setName("submit")
        .setDescription("Submit an appeal for one of your cases")
        .addStringOption((o) =>
          o.setName("case_id").setDescription("Case ID").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("reason").setDescription("Appeal reason").setRequired(true),
        ),
    )
    .addSubcommand((sc) =>
      sc.setName("mine").setDescription("View your recent appeals"),
    )
    .addSubcommand((sc) =>
      sc
        .setName("view")
        .setDescription("View a specific appeal")
        .addStringOption((o) =>
          o.setName("appeal_id").setDescription("Appeal ID").setRequired(true),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName("review")
        .setDescription("Review an appeal")
        .addStringOption((o) =>
          o.setName("appeal_id").setDescription("Appeal ID").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("status")
            .setDescription("Decision")
            .setRequired(true)
            .addChoices(
              { name: "approved", value: "approved" },
              { name: "denied", value: "denied" },
            ),
        )
        .addStringOption((o) =>
          o
            .setName("note")
            .setDescription("Optional review note")
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const guildId = interaction.guild.id;
      const sub = interaction.options.getSubcommand();

      if (sub === "submit") {
        const caseId = interaction.options.getString("case_id", true);
        const reason = interaction.options.getString("reason", true).trim();

        const row = await prisma.modCase.findFirst({
          where: { id: caseId, guildId },
        });

        if (!row) {
          return interaction.editReply({ content: "❌ Case not found." });
        }

        if (row.targetUserId !== interaction.user.id && !isMod(interaction)) {
          return interaction.editReply({
            content: "❌ You can only appeal your own cases.",
          });
        }

        const existingPending = await prisma.appeal.findFirst({
          where: {
            caseId: row.id,
            guildId,
            userId: interaction.user.id,
            status: "pending",
          },
        });

        if (existingPending) {
          return interaction.editReply({
            content: `❌ You already have a pending appeal for this case: \`${existingPending.id}\`.`,
          });
        }

        const created = await prisma.appeal.create({
          data: {
            caseId: row.id,
            guildId,
            userId: interaction.user.id,
            reason,
          },
        });

        return interaction.editReply({
          content: `✅ Appeal submitted. Appeal ID: \`${created.id}\` for case \`${row.id}\`.`,
        });
      }

      if (sub === "mine") {
        const appeals = await prisma.appeal.findMany({
          where: {
            guildId,
            userId: interaction.user.id,
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        const embed = new EmbedBuilder()
          .setTitle("📨 Your appeals")
          .setTimestamp();

        if (appeals.length === 0) {
          embed.setDescription("You have no appeals on record.");
        } else {
          embed.setDescription(
            appeals
              .map(
                (a) =>
                  `• \`${a.id}\` — case \`${a.caseId}\` — **${a.status}** — <t:${Math.floor(
                    new Date(a.createdAt).getTime() / 1000,
                  )}:R>`,
              )
              .join("\n"),
          );
        }

        return interaction.editReply({ embeds: [embed] });
      }

      if (sub === "view") {
        const appealId = interaction.options.getString("appeal_id", true);

        const row = await prisma.appeal.findFirst({
          where: { id: appealId, guildId },
        });

        if (!row) {
          return interaction.editReply({ content: "❌ Appeal not found." });
        }

        if (row.userId !== interaction.user.id && !isMod(interaction)) {
          return interaction.editReply({
            content: "❌ You can only view your own appeals.",
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(`📨 Appeal ${row.id}`)
          .addFields(
            { name: "Case ID", value: `\`${row.caseId}\``, inline: true },
            { name: "Status", value: row.status, inline: true },
            { name: "User", value: `<@${row.userId}>`, inline: true },
            { name: "Reason", value: row.reason },
          )
          .setTimestamp();

        if (row.reviewNote) {
          embed.addFields({
            name: "Review Note",
            value: row.reviewNote,
          });
        }

        return interaction.editReply({ embeds: [embed] });
      }

      if (sub === "review") {
        if (!isMod(interaction)) {
          return interaction.editReply({
            content: "❌ You do not have permission to review appeals.",
          });
        }

        const appealId = interaction.options.getString("appeal_id", true);
        const status = interaction.options.getString("status", true);
        const note = interaction.options.getString("note")?.trim() || null;

        const appeal = await prisma.appeal.findFirst({
          where: { id: appealId, guildId },
        });

        if (!appeal) {
          return interaction.editReply({ content: "❌ Appeal not found." });
        }

        const linkedCase = await prisma.modCase.findFirst({
          where: { id: appeal.caseId, guildId },
        });

        if (!linkedCase) {
          return interaction.editReply({
            content: "❌ Linked case not found.",
          });
        }

        await prisma.appeal.update({
          where: { id: appeal.id },
          data: {
            status,
            reviewedById: interaction.user.id,
            reviewNote: note,
            reviewedAt: new Date(),
          },
        });

        if (status === "approved") {
          await prisma.modCase.update({
            where: { id: linkedCase.id },
            data: { status: "overturned" },
          });

          if (linkedCase.infractionId) {
            const inf = await prisma.infraction.findUnique({
              where: { id: linkedCase.infractionId },
            });

            if (inf?.type === "warn") {
              await prisma.infraction.update({
                where: { id: inf.id },
                data: { expiresAt: new Date() },
              });
            }

            if (inf?.type === "timeout") {
              const member = await interaction.guild.members
                .fetch(linkedCase.targetUserId)
                .catch(() => null);

              if (member?.isCommunicationDisabled()) {
                await member.timeout(null, "Appeal approved").catch(() => null);
              }
            }
          }
        } else {
          await prisma.modCase.update({
            where: { id: linkedCase.id },
            data: { status: "upheld" },
          });
        }

        return interaction.editReply({
          content: `✅ Appeal \`${appeal.id}\` marked **${status}**.`,
        });
      }
    } catch (error) {
      console.error("[/appeal]", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Something went wrong while running `/appeal`.",
        });
      }

      return interaction.reply({
        content: "❌ Something went wrong while running `/appeal`.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
