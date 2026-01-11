// src/modules/games/counting/handler.js
const { prisma } = require("../../../core/database");

async function softWarn(channel, text) {
  try {
    const msg = await channel.send(text);
    setTimeout(() => msg.delete().catch(() => {}), 5000);
  } catch {
    // ignore
  }
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

  // Debug: log state + message
  console.log("[counting-debug] state:", {
    guildId: state.guildId,
    channelId: state.channelId,
    current: state.current,
    lastUserId: state.lastUserId,
  });
  console.log("[counting-debug] message:", {
    authorId: message.author.id,
    content,
  });

  const nextNumber = state.current + 1;

  async function fail(reasonText) {
    try {
      await message.react("❌").catch(() => {});
    } catch {
      // ignore
    }

    setTimeout(() => {
      message.delete().catch(() => {});
    }, 3000);

    await softWarn(message.channel, reasonText);
  }

  // Only allow pure integers
  if (!/^\d+$/.test(content)) {
    await fail(`❌ Numbers only. Next number is **${nextNumber}**.`);
    console.log("[counting-debug] reject: non-numeric");
    return;
  }

  const num = parseInt(content, 10);
  const expected = nextNumber;

  if (num !== expected) {
    await fail(`❌ Wrong number. Next number is **${expected}**.`);
    console.log("[counting-debug] reject: wrong number", { num, expected });
    return;
  }

  // ✅ Correct number
  try {
    await message.react("✅").catch(() => {});
  } catch {
    // ignore
  }

  await prisma.countingState.update({
    where: { guildId: message.guild.id },
    data: {
      current: num,
      lastUserId: message.author.id, // kept for future rules/leaderboard
    },
  });

  console.log("[counting-debug] accepted:", {
    num,
    newCurrent: num,
    userId: message.author.id,
  });
}

module.exports = { handleCounting };
