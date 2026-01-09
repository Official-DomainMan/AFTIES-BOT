const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../core/database");
const { getPolicy } = require("../policy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("modpolicy")
    .setDescription("View or set moderation automation policy")
    .addSubcommand((sc) =>
      sc.setName("view").setDescription("View current policy")
    )
    .addSubcommand((sc) =>
      sc
        .setName("set")
        .setDescription("Set policy values")
        .addIntegerOption((o) =>
          o
            .setName("warn_expires_days")
            .setDescription("Warn decay days (e.g. 30)")
        )
        .addIntegerOption((o) =>
          o
            .setName("warn_window_days")
            .setDescription("Window (in days) for auto-timeout (e.g. 7)")
        )
        .addIntegerOption((o) =>
          o
            .setName("auto_timeout_warn_count")
            .setDescription("Warns before auto-timeout (e.g. 3)")
        )
        .addIntegerOption((o) =>
          o
            .setName("auto_timeout_minutes")
            .setDescription("Auto-timeout duration in minutes (e.g. 60)")
        )
        .addBooleanOption((o) =>
          o
            .setName("dm_on_warn")
            .setDescription("DM users when they are warned?")
        )
        .addBooleanOption((o) =>
          o
            .setName("dm_on_auto_timeout")
            .setDescription("DM users when auto-timeout triggers?")
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guild.id;
    const sub = interaction.options.getSubcommand();

    if (sub === "view") {
      const p = await getPolicy(guildId);

      await interaction.editReply(
        [
          "🛡️ **Moderation Policy**",
          `• Warn decay: **${p.warnExpiresDays} days**`,
          `• Auto-timeout window: **${p.warnWindowDays} days**`,
          `• Auto-timeout trigger: **${p.autoTimeoutWarnCount} warns**`,
          `• Auto-timeout duration: **${p.autoTimeoutMinutes} minutes**`,
          "",
          `• DM on warn: **${p.dmOnWarn ? "enabled" : "disabled"}**`,
          `• DM on auto-timeout: **${
            p.dmOnAutoTimeout ? "enabled" : "disabled"
          }**`,
        ].join("\n")
      );
      return;
    }

    // sub === "set"
    const updates = {};
    const _int = (name) => interaction.options.getInteger(name);
    const _bool = (name) => interaction.options.getBoolean(name);

    const warnExpiresDays = _int("warn_expires_days");
    const warnWindowDays = _int("warn_window_days");
    const autoTimeoutWarnCount = _int("auto_timeout_warn_count");
    const autoTimeoutMinutes = _int("auto_timeout_minutes");
    const dmOnWarn = _bool("dm_on_warn");
    const dmOnAutoTimeout = _bool("dm_on_auto_timeout");

    if (warnExpiresDays != null)
      updates.warnExpiresDays = Math.max(1, warnExpiresDays);
    if (warnWindowDays != null)
      updates.warnWindowDays = Math.max(1, warnWindowDays);
    if (autoTimeoutWarnCount != null)
      updates.autoTimeoutWarnCount = Math.max(1, autoTimeoutWarnCount);
    if (autoTimeoutMinutes != null)
      updates.autoTimeoutMinutes = Math.max(1, autoTimeoutMinutes);
    if (dmOnWarn != null) updates.dmOnWarn = dmOnWarn;
    if (dmOnAutoTimeout != null) updates.dmOnAutoTimeout = dmOnAutoTimeout;

    await prisma.modPolicy.upsert({
      where: { guildId },
      update: updates,
      create: { guildId, ...updates },
    });

    const p = await getPolicy(guildId);

    await interaction.editReply(
      [
        "✅ Moderation policy updated.",
        "",
        `• Warn decay: **${p.warnExpiresDays} days**`,
        `• Window: **${p.warnWindowDays} days**`,
        `• Trigger: **${p.autoTimeoutWarnCount} warns**`,
        `• Timeout: **${p.autoTimeoutMinutes} minutes**`,
        `• DM on warn: **${p.dmOnWarn ? "enabled" : "disabled"}**`,
        `• DM on auto-timeout: **${
          p.dmOnAutoTimeout ? "enabled" : "disabled"
        }**`,
      ].join("\n")
    );
  },
};
