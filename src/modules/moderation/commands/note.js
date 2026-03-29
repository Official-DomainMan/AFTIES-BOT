const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("Add or view moderator notes on a user")
    .addSubcommand((sc) =>
      sc
        .setName("add")
        .setDescription("Add a moderator note")
        .addUserOption((o) =>
          o.setName("user").setDescription("User").setRequired(true),
        )
        .addStringOption((o) =>
          o.setName("note").setDescription("Note text").setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName("case_id")
            .setDescription("Optional case to attach this note to")
            .setRequired(false),
        ),
    )
    .addSubcommand((sc) =>
      sc
        .setName("view")
        .setDescription("View moderator notes for a user")
        .addUserOption((o) =>
          o.setName("user").setDescription("User").setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const guildId = interaction.guild.id;
      const sub = interaction.options.getSubcommand();

      if (sub === "add") {
        const user = interaction.options.getUser("user", true);
        const note = interaction.options.getString("note", true).trim();
        const caseId = interaction.options.getString("case_id");

        const inf = await prisma.infraction.create({
          data: {
            guildId,
            userId: user.id,
            modId: interaction.user.id,
            type: "note",
            reason: note,
          },
        });

        if (caseId) {
          const row = await prisma.modCase.findFirst({
            where: { id: caseId, guildId },
          });

          if (row) {
            await prisma.caseNote.create({
              data: {
                caseId: row.id,
                guildId,
                authorId: interaction.user.id,
                note,
              },
            });
          }
        }

        return interaction.editReply({
          content: `✅ Added moderator note \`${inf.id}\` for <@${user.id}>.`,
        });
      }

      if (sub === "view") {
        const user = interaction.options.getUser("user", true);

        const notes = await prisma.infraction.findMany({
          where: {
            guildId,
            userId: user.id,
            type: "note",
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

        const embed = new EmbedBuilder()
          .setTitle(`📝 Moderator notes for ${user.tag ?? user.username}`)
          .setTimestamp();

        if (notes.length === 0) {
          embed.setDescription("No moderator notes found for that user.");
        } else {
          embed.setDescription(
            notes
              .map(
                (n, i) =>
                  `**${i + 1}.** \`${n.id}\`\n• by: <@${n.modId}>\n• created: <t:${Math.floor(
                    new Date(n.createdAt).getTime() / 1000,
                  )}:R>\n• ${String(n.reason || "No note text").slice(0, 140)}`,
              )
              .join("\n\n")
              .slice(0, 4096),
          );
        }

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("[/note]", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Something went wrong while running `/note`.",
        });
      }

      return interaction.reply({
        content: "❌ Something went wrong while running `/note`.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
