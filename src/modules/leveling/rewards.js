// src/modules/leveling/rewards.js
const { prisma } = require("../../core/database");

/**
 * Apply level-based role rewards.
 * - Looks up LevelRole for (guildId, level)
 * - If a role is configured, adds it to the member
 */
async function applyLevelRewards(guild, userId, level) {
  try {
    if (!guild) return;

    const guildId = guild.id;

    const reward = await prisma.levelRole.findUnique({
      where: {
        guildId_level: {
          guildId,
          level,
        },
      },
    });

    if (!reward) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const roleId = reward.roleId;
    const role = guild.roles.cache.get(roleId);
    if (!role) return;

    // Make sure the bot can actually add this role
    if (!guild.members.me.permissions.has("ManageRoles")) return;
    if (role.position >= guild.members.me.roles.highest.position) return;

    await member.roles.add(roleId).catch(() => {});
  } catch (err) {
    console.error("[leveling] applyLevelRewards error:", err);
  }
}

module.exports = {
  applyLevelRewards,
};
