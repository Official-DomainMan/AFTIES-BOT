const { prisma } = require("../../../core/database");

async function softWarn(channel, text) {
  try {
    const msg = await channel.send(text);
    setTimeout(() => msg.delete().catch(() => {}), 5000);
  } catch {}
}

async function handleCounting(message) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const state = await prisma.countingState.findUnique({
    where: { guildId: message.guild.id },
  });

  if (!state) return;
  if (message.channel.id !== state.channelId) return;

  const content = message.content.trim();

  // Only allow pure integers
  if (!/^\d+$/.test(content)) {
    await message.delete().catch(() => {});
    await softWarn(
      message.channel,
      `❌ Numbers only. Next number is **${state.current + 1}**.`
    );
    return;
  }

  const num = parseInt(content, 10);
  const expected = state.current + 1;

  // No same user twice in a row
  if (state.lastUserId === message.author.id) {
    await message.delete().catch(() => {});
    await softWarn(
      message.channel,
      `⛔ Not twice in a row. Next number is **${expected}**.`
    );
    return;
  }

  if (num !== expected) {
    await message.delete().catch(() => {});
    await softWarn(
      message.channel,
      `❌ Wrong number. Next number is **${expected}**.`
    );
    return;
  }

  // ✅ accept: update counting state
  await prisma.countingState.update({
    where: { guildId: message.guild.id },
    data: { current: num, lastUserId: message.author.id },
  });

  // ✅ accept: award leaderboard point
  await prisma.countingUserStat.upsert({
    where: {
      guildId_userId: {
        guildId: message.guild.id,
        userId: message.author.id,
      },
    },
    update: {
      points: { increment: 1 },
      lastCount: new Date(),
    },
    create: {
      guildId: message.guild.id,
      userId: message.author.id,
      points: 1,
      lastCount: new Date(),
    },
  });
}

module.exports = { handleCounting };
