const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require("discord.js");
const { prisma } = require("../../../core/database");
const { getPolicy } = require("../policy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("modpolicy")
    .setDescription("View or set moderation automation policy")
    .addSubcommand((sc) =>
      sc.setName("view").setDescription("View current policy"),
    )
    .addSubcommand((sc) =>
      sc
        .setName("set")
        .setDescription("Set policy values")
        .addIntegerOption((o) =>
          o
            .setName("warn_expires_days")
            .setDescription("Warn decay days (example: 30)")
            .setMinValue(1),
        )
        .addIntegerOption((o) =>
          o
            .setName("warn_window_days")
            .setDescription("Window in days for auto-timeout (example: 7)")
            .setMinValue(1),
        )
        .addIntegerOption((o) =>
          o
            .setName("auto_timeout_warn_count")
            .setDescription("Warn count before auto-timeout (example: 3)")
            .setMinValue(1),
        )
        .addIntegerOption((o) =>
          o
            .setName("auto_timeout_minutes")
            .setDescription("Auto-timeout duration in minutes (example: 60)")
            .setMinValue(1),
        )
        .addBooleanOption((o) =>
          o
            .setName("dm_on_warn")
            .setDescription("DM users when they are warned?"),
        )
        .addBooleanOption((o) =>
          o
            .setName("dm_on_auto_timeout")
            .setDescription("DM users when auto-timeout triggers?"),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const tag = `[modpolicy pid=${process.pid} id=${interaction.id}]`;

    try {
      console.log(
        `${tag} execute start | deferred=${interaction.deferred} replied=${interaction.replied}`,
      );

      const guildId = interaction.guild.id;
      const sub = interaction.options.getSubcommand();

      if (sub === "view") {
        const p = await getPolicy(guildId);

        const embed = new EmbedBuilder()
          .setTitle("🛡️ Moderation Policy")
          .setDescription(
            "Current automatic warning and timeout settings for this server.",
          )
          .addFields(
            {
              name: "Warn Decay",
              value: `${p.warnExpiresDays} day(s)`,
              inline: true,
            },
            {
              name: "Warn Window",
              value: `${p.warnWindowDays} day(s)`,
              inline: true,
            },
            {
              name: "Trigger Count",
              value: `${p.autoTimeoutWarnCount} warn(s)`,
              inline: true,
            },
            {
              name: "Auto-timeout Length",
              value: `${p.autoTimeoutMinutes} minute(s)`,
              inline: true,
            },
            {
              name: "DM on Warn",
              value: p.dmOnWarn ? "Enabled" : "Disabled",
              inline: true,
            },
            {
              name: "DM on Auto-timeout",
              value: p.dmOnAutoTimeout ? "Enabled" : "Disabled",
              inline: true,
            },
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      }

      const updates = {};
      const warnExpiresDays =
        interaction.options.getInteger("warn_expires_days");
      const warnWindowDays = interaction.options.getInteger("warn_window_days");
      const autoTimeoutWarnCount = interaction.options.getInteger(
        "auto_timeout_warn_count",
      );
      const autoTimeoutMinutes = interaction.options.getInteger(
        "auto_timeout_minutes",
      );
      const dmOnWarn = interaction.options.getBoolean("dm_on_warn");
      const dmOnAutoTimeout =
        interaction.options.getBoolean("dm_on_auto_timeout");

      if (warnExpiresDays != null) updates.warnExpiresDays = warnExpiresDays;
      if (warnWindowDays != null) updates.warnWindowDays = warnWindowDays;
      if (autoTimeoutWarnCount != null) {
        updates.autoTimeoutWarnCount = autoTimeoutWarnCount;
      }
      if (autoTimeoutMinutes != null)
        updates.autoTimeoutMinutes = autoTimeoutMinutes;
      if (dmOnWarn != null) updates.dmOnWarn = dmOnWarn;
      if (dmOnAutoTimeout != null) updates.dmOnAutoTimeout = dmOnAutoTimeout;

      if (Object.keys(updates).length === 0) {
        return interaction.editReply({
          content:
            "❌ You didn't provide any values to update. Use `/modpolicy set` with at least one option.",
        });
      }

      const current = await getPolicy(guildId);
      const next = {
        warnExpiresDays: updates.warnExpiresDays ?? current.warnExpiresDays,
        warnWindowDays: updates.warnWindowDays ?? current.warnWindowDays,
        autoTimeoutWarnCount:
          updates.autoTimeoutWarnCount ?? current.autoTimeoutWarnCount,
        autoTimeoutMinutes:
          updates.autoTimeoutMinutes ?? current.autoTimeoutMinutes,
        dmOnWarn: updates.dmOnWarn ?? current.dmOnWarn,
        dmOnAutoTimeout: updates.dmOnAutoTimeout ?? current.dmOnAutoTimeout,
      };

      if (next.warnExpiresDays < next.warnWindowDays) {
        return interaction.editReply({
          content:
            "❌ `warn_expires_days` should not be lower than `warn_window_days`.",
        });
      }

      await prisma.modPolicy.upsert({
        where: { guildId },
        update: updates,
        create: { guildId, ...updates },
      });

      const p = await getPolicy(guildId);

      const embed = new EmbedBuilder()
        .setTitle("✅ Moderation Policy Updated")
        .setDescription(
          "The server moderation automation policy has been updated.",
        )
        .addFields(
          {
            name: "Warn Decay",
            value: `${p.warnExpiresDays} day(s)`,
            inline: true,
          },
          {
            name: "Warn Window",
            value: `${p.warnWindowDays} day(s)`,
            inline: true,
          },
          {
            name: "Trigger Count",
            value: `${p.autoTimeoutWarnCount} warn(s)`,
            inline: true,
          },
          {
            name: "Auto-timeout Length",
            value: `${p.autoTimeoutMinutes} minute(s)`,
            inline: true,
          },
          {
            name: "DM on Warn",
            value: p.dmOnWarn ? "Enabled" : "Disabled",
            inline: true,
          },
          {
            name: "DM on Auto-timeout",
            value: p.dmOnAutoTimeout ? "Enabled" : "Disabled",
            inline: true,
          },
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error(`${tag} fatal error:`, error);

      return interaction.editReply({
        content: "❌ Something went wrong while running `/modpolicy`.",
      });
    }
  },
};
