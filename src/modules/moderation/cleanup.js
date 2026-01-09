const { prisma } = require("../../core/database");
const { postModLog } = require("./modlog");

async function cleanupExpiredWarns(client) {
  const now = new Date();

  // Find expired warns so we can count per guild
  const expired = await prisma.infraction.findMany({
    where: {
      type: "warn",
      expiresAt: { lte: now },
    },
    select: { id: true, guildId: true },
  });

  if (expired.length === 0) return;

  const counts = new Map();
  for (const row of expired) {
    counts.set(row.guildId, (counts.get(row.guildId) ?? 0) + 1);
  }

  // Delete them in one go
  await prisma.infraction.deleteMany({
    where: {
      type: "warn",
      expiresAt: { lte: now },
    },
  });

  // Light-touch: log a short summary per guild (only if modlog is set)
  for (const [guildId, count] of counts.entries()) {
    await postModLog(
      client,
      guildId,
      `🧹 **Warn decay cleanup** • removed **${count}** expired warns`
    );
  }
}

function startCleanupLoop(client) {
  // Run once on startup
  cleanupExpiredWarns(client).catch(console.error);

  // Then every 6 hours
  setInterval(() => {
    cleanupExpiredWarns(client).catch(console.error);
  }, 6 * 60 * 60 * 1000);
}

module.exports = { startCleanupLoop };
