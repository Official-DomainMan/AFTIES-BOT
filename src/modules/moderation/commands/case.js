const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("case")
    .setDescription("View and manage moderation cases")
    .addSubcommand((sc) =>
      sc
        .setName("view")
        .setDescription("View a case")
        .addStringOption((o) =>
          o.setName("id").setDescription("Case ID").setRequired(true),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName("note")
        .setDescription("Add an internal note to a case")
        .addStringOption((o) =>
          o.setName("id").setDescription("Case ID").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("note").setDescription("Note text").setRequired(true),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName("status")
        .setDescription("Update case status")
        .addStringOption((o) =>
          o.setName("id").setDescription("Case ID").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("status")
            .setDescription("New case status")
            .setRequired(true)
            .addChoices(
              { name: "open", value: "open" },
              { name: "closed", value: "closed" },
              { name: "upheld", value: "upheld" },
              { name: "overturned", value: "overturned" },
            ),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const sub = interaction.options.getSubcommand();
      const guildId = interaction.guild.id;

      if (sub === "view") {
        const id = interaction.options.getString("id", true);

        const row = await prisma.modCase.findFirst({
          where: { id, guildId },
          include: {
            notes: { orderBy: { createdAt: "desc" }, take: 5 },
            appeals: { orderBy: { createdAt: "desc" }, take: 5 },
          },
        });

        if (!row) {
          return interaction.editReply({ content: "❌ Case not found." });
        }

        const embed = new EmbedBuilder()
          .setTitle(`📁 Case ${row.id}`)
          .addFields(
            { name: "Type", value: row.type, inline: true },
            { name: "Status", value: row.status, inline: true },
            {
              name: "Target",
              value: `<@${row.targetUserId}> (\`${row.targetUserId}\`)`,
              inline: true,
            },
            {
              name: "Actor",
              value: `<@${row.actorUserId}> (\`${row.actorUserId}\`)`,
              inline: true,
            },
            {
              name: "Linked Infraction",
              value: row.infractionId ? `\`${row.infractionId}\`` : "None",
              inline: true,
            },
            {
              name: "Created",
              value: `<t:${Math.floor(new Date(row.createdAt).getTime() / 1000)}:F>`,
              inline: true,
            },
            {
              name: "Reason",
              value: row.reason || "No reason provided",
            },
          )
          .setTimestamp();

        if (row.notes.length > 0) {
          embed.addFields({
            name: "Recent Case Notes",
            value: row.notes
              .map(
                (n) =>
                  `• <t:${Math.floor(new Date(n.createdAt).getTime() / 1000)}:R> by <@${n.authorId}> — ${n.note.slice(0, 120)}`,
              )
              .join("\n")
              .slice(0, 1024),
          });
        }

        if (row.appeals.length > 0) {
          embed.addFields({
            name: "Appeals",
            value: row.appeals
              .map(
                (a) =>
                  `• \`${a.id}\` — **${a.status}** — <@${a.userId}> — <t:${Math.floor(new Date(a.createdAt).getTime() / 1000)}:R>`,
              )
              .join("\n")
              .slice(0, 1024),
          });
        }

        return interaction.editReply({ embeds: [embed] });
      }

      if (sub === "note") {
        const id = interaction.options.getString("id", true);
        const note = interaction.options.getString("note", true).trim();

        const row = await prisma.modCase.findFirst({
          where: { id, guildId },
        });

        if (!row) {
          return interaction.editReply({ content: "❌ Case not found." });
        }

        const created = await prisma.caseNote.create({
          data: {
            caseId: row.id,
            guildId,
            authorId: interaction.user.id,
            note,
          },
        });

        return interaction.editReply({
          content: `✅ Added note \`${created.id}\` to case \`${row.id}\`.`,
        });
      }

      if (sub === "status") {
        const id = interaction.options.getString("id", true);
        const status = interaction.options.getString("status", true);

        const row = await prisma.modCase.findFirst({
          where: { id, guildId },
        });

        if (!row) {
          return interaction.editReply({ content: "❌ Case not found." });
        }

        await prisma.modCase.update({
          where: { id: row.id },
          data: { status },
        });

        return interaction.editReply({
          content: `✅ Case \`${row.id}\` status updated to **${status}**.`,
        });
      }
    } catch (error) {
      console.error("[/case]", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Something went wrong while running `/case`.",
        });
      }

      return interaction.reply({
        content: "❌ Something went wrong while running `/case`.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
