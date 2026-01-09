const { prisma } = require("../../core/database");

async function getPolicy(guildId) {
  const policy = await prisma.modPolicy.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });

  // Backfill any nulls (in case of old rows)
  return {
    ...policy,
    warnExpiresDays: policy.warnExpiresDays ?? 30,
    warnWindowDays: policy.warnWindowDays ?? 7,
    autoTimeoutWarnCount: policy.autoTimeoutWarnCount ?? 3,
    autoTimeoutMinutes: policy.autoTimeoutMinutes ?? 60,
    dmOnWarn: policy.dmOnWarn ?? false,
    dmOnAutoTimeout: policy.dmOnAutoTimeout ?? false,
  };
}

module.exports = { getPolicy };
