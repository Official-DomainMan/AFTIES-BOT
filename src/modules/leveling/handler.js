// src/modules/leveling/handler.js
const { EmbedBuilder } = require("discord.js");
const { prisma } = require("../../core/database");

// ============================
// XP CONFIG
// ============================

const MESSAGE_XP_MIN = 4;
const MESSAGE_XP_MAX = 9;

const MESSAGE_COOLDOWN_MS = 90_000; // 1.5 minutes

// XP curve
function getRequiredXpForLevel(level) {
  if (level <= 0) return 0;
  return 50 + level * level * 75;
}

function getRandomMessageXp() {
  const range = MESSAGE_XP_MAX - MESSAGE_XP_MIN + 1;
  return MESSAGE_XP_MIN + Math.floor(Math.random() * range);
}

// ============================
// SHARED XP AWARD FUNCTION
// ============================

async function addXpForUser(guildId, userId, amount, client) {
  const now = new Date();

  let profile = await prisma.levelProfile.findUnique({
    where: {
      guildId_userId: { guildId, userId },
    },
  });

  if (!profile) {
    profile = await prisma.levelProfile.create({
      data: {
        guildId,
        userId,
        xp: 0,
        level: 0,
        lastXpAt: null,
      },
    });
  }

  let newXp = profile.xp + amount;
  let newLevel = profile.level;
  let leveledUp = false;

  while (true) {
    const required = getRequiredXpForLevel(newLevel + 1);
    if (required <= 0) break;

    if (newXp >= required) {
      newXp -= required;
      newLevel++;
      leveledUp = true;
    } else {
      break;
    }
  }

  profile = await prisma.levelProfile.update({
    where: {
      guildId_userId: { guildId, userId },
    },
    data: {
      xp: newXp,
      level: newLevel,
      lastXpAt: now,
    },
  });

  if (!leveledUp) return;

  // Announce level up
  let targetChannelId = null;

  try {
    const settings = await prisma.levelSettings.findUnique({
      where: { guildId },
    });

    if (settings?.levelUpChannelId) {
      targetChannelId = settings.levelUpChannelId;
    }
  } catch {}

  if (!targetChannelId) return; // no announcement configured

  const channel =
    client.channels.cache.get(targetChannelId) ??
    (await client.channels.fetch(targetChannelId).catch(() => null));

  if (!channel || !channel.isTextBased()) return;

  await channel
    .send({
      embeds: [
        new EmbedBuilder()
          .setTitle("⬆️ Level Up!")
          .setDescription(`<@${userId}> reached **level ${newLevel}**`)
          .setColor(0x2ecc71)
          .setTimestamp(),
      ],
    })
    .catch(() => {});
}

// ============================
// MESSAGE XP ROUTE
// ============================

async function handleLevelingMessage(message) {
  try {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const now = new Date();

    let profile = await prisma.levelProfile.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!profile) {
      profile = await prisma.levelProfile.create({
        data: {
          guildId,
          userId,
          xp: 0,
          level: 0,
          lastXpAt: null,
        },
      });
    }

    if (profile.lastXpAt) {
      const diff = now - new Date(profile.lastXpAt);
      if (diff < MESSAGE_COOLDOWN_MS) return;
    }

    const xpGain = getRandomMessageXp();
    await addXpForUser(guildId, userId, xpGain, message.client);

    try {
      await message.react("⬆️");
    } catch {}
  } catch (err) {
    console.error("[leveling] handleLevelingMessage error:", err);
  }
}

module.exports = {
  handleLevelingMessage,
  addXpForUser,
  getRequiredXpForLevel,
};
