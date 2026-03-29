const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("modstats")
    .setDescription("Moderation analytics overview")
    .addSubcommand((sc) =>
      sc
        .setName("overview")
        .setDescription("View moderation stats")
        .addIntegerOption((o) =>
          o
            .setName("days")
            .setDescription("Lookback window in days")
            .setMinValue(1)
            .setMaxValue(365)
            .setRequired(false),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    try {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const sub = interaction.options.getSubcommand();

      if (sub !== "overview") {
        return interaction.editReply({ content: "❌ Unknown subcommand." });
      }

      const days = interaction.options.getInteger("days") ?? 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [infractions, cases, appeals] = await Promise.all([
        prisma.infraction.findMany({
          where: {
            guildId: interaction.guild.id,
            createdAt: { gte: since },
          },
        }),
        prisma.modCase.findMany({
          where: {
            guildId: interaction.guild.id,
            createdAt: { gte: since },
          },
        }),
        prisma.appeal.findMany({
          where: {
            guildId: interaction.guild.id,
            createdAt: { gte: since },
          },
        }),
      ]);

      const byType = {};
      const byMod = {};
      const warnedUsers = {};
      let pendingAppeals = 0;

      for (const inf of infractions) {
        byType[inf.type] = (byType[inf.type] || 0) + 1;
        byMod[inf.modId] = (byMod[inf.modId] || 0) + 1;

        if (inf.type === "warn") {
          warnedUsers[inf.userId] = (warnedUsers[inf.userId] || 0) + 1;
        }
      }

      for (const appeal of appeals) {
        if (appeal.status === "pending") pendingAppeals += 1;
      }

      const topMods = Object.entries(byMod)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => `• <@${id}> — **${count}** action(s)`);

      const topWarned = Object.entries(warnedUsers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, count]) => `• <@${id}> — **${count}** warn(s)`);

      const typeLines = Object.entries(byType)
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => `• **${type}**: ${count}`);

      const embed = new EmbedBuilder()
        .setTitle(`📊 Moderation stats (${days} day${days === 1 ? "" : "s"})`)
        .addFields(
          {
            name: "Infractions",
            value: `${infractions.length}`,
            inline: true,
          },
          {
            name: "Cases",
            value: `${cases.length}`,
            inline: true,
          },
          {
            name: "Pending Appeals",
            value: `${pendingAppeals}`,
            inline: true,
          },
          {
            name: "By Type",
            value: typeLines.length
              ? typeLines.join("\n").slice(0, 1024)
              : "None",
          },
          {
            name: "Top Moderators",
            value: topMods.length ? topMods.join("\n").slice(0, 1024) : "None",
          },
          {
            name: "Top Warned Users",
            value: topWarned.length
              ? topWarned.join("\n").slice(0, 1024)
              : "None",
          },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("[/modstats]", error);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: "❌ Something went wrong while running `/modstats`.",
        });
      }

      return interaction.reply({
        content: "❌ Something went wrong while running `/modstats`.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
