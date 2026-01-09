const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("infractions")
    .setDescription("View a user's infractions")
    .addUserOption((o) =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addIntegerOption((o) =>
      o
        .setName("limit")
        .setDescription("How many (default 10, max 25)")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user", true);
    const limitRaw = interaction.options.getInteger("limit") ?? 10;
    const limit = Math.max(1, Math.min(25, limitRaw));

    const rows = await prisma.infraction.findMany({
      where: { guildId: interaction.guild.id, userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (rows.length === 0) {
      await interaction.editReply(`ℹ️ No infractions found for <@${user.id}>.`);
      return;
    }

    const lines = rows.map((r) => {
      const ts = `<t:${Math.floor(new Date(r.createdAt).getTime() / 1000)}:R>`;
      return `• **${r.type}** ${ts} • id \`${r.id}\` • mod <@${r.modId}>\n  > ${
        r.reason ?? "—"
      }`;
    });

    await interaction.editReply(
      `📒 **Infractions for <@${user.id}>**\n` + lines.join("\n")
    );
  },
};
