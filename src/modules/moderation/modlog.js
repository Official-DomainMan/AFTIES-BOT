const { prisma } = require("../../core/database");

async function getModLogChannelId(guildId) {
  const cfg = await prisma.modConfig.findUnique({ where: { guildId } });
  return cfg?.logChannelId ?? null;
}

async function postModLog(client, guildId, text) {
  try {
    const channelId = await getModLogChannelId(guildId);
    if (!channelId) return;

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (!ch || !ch.isTextBased()) return;

    await ch.send(text);
  } catch {}
}

module.exports = { postModLog };
