const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warnings")
    .setDescription("View warning history for a user")
    .addUserOption((o) =>
      o.setName("user").setDescription("User to inspect").setRequired(true),
    )
    .addBooleanOption((o) =>
      o
        .setName("show_expired")
        .setDescription("Include expired warnings in the list")
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const user = interaction.options.getUser("user", true);
      const showExpired =
        interaction.options.getBoolean("show_expired") ?? false;
      const now = new Date();

      const warns = await prisma.infraction.findMany({
        where: {
          guildId: interaction.guild.id,
          userId: user.id,
          type: "warn",
          ...(showExpired
            ? {}
            : {
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              }),
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });

      const allWarns = await prisma.infraction.findMany({
        where: {
          guildId: interaction.guild.id,
          userId: user.id,
          type: "warn",
        },
        orderBy: { createdAt: "desc" },
      });

      const activeCount = allWarns.filter(
        (w) => !w.expiresAt || new Date(w.expiresAt) > now,
      ).length;

      const caseMap = new Map();
      if (warns.length > 0) {
        const cases = await prisma.modCase.findMany({
          where: {
            infractionId: { in: warns.map((w) => w.id) },
          },
        });

        for (const row of cases) {
          caseMap.set(row.infractionId, row.id);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚠️ Warnings for ${user.tag ?? user.username}`)
        .addFields(
          { name: "Active Warnings", value: `${activeCount}`, inline: true },
          { name: "Total Warnings", value: `${allWarns.length}`, inline: true },
          {
            name: "Showing",
            value: showExpired ? "Active + expired" : "Active only",
            inline: true,
          },
        )
        .setTimestamp();

      if (warns.length === 0) {
        embed.setDescription("No warnings found for that user.");
      } else {
        const lines = warns.map((w, i) => {
          const expired =
            w.expiresAt && new Date(w.expiresAt) <= now ? "expired" : "active";
          const caseId = caseMap.get(w.id) || "none";
          const reason = w.reason || "No reason provided";
          return [
            `**${i + 1}.** \`${w.id}\``,
            `• case: \`${caseId}\``,
            `• status: **${expired}**`,
            `• created: <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>`,
            `• reason: ${reason.slice(0, 120)}`,
          ].join("\n");
        });

        embed.setDescription(lines.join("\n\n").slice(0, 4096));
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("[/warnings]", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Something went wrong while running `/warnings`.",
        });
      }

      return interaction.reply({
        content: "❌ Something went wrong while running `/warnings`.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
