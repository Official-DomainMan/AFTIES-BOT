// src/modules/leveling/handler.js
const { prisma } = require("../../core/database");
const { applyLevelRewards } = require("./rewards");

const COOLDOWN_MS = 15_000; // 15s cooldown for message/reaction XP

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Core XP function used by:
 *  - text messages
 *  - reactions
 *  - voice-time payouts
 *
 * Options:
 *  - minXp / maxXp: random range
 *  - fixedXp: exact amount (overrides min/max)
 *  - bypassCooldown: ignore 15s cooldown (used for voice-time)
 */
async function awardXpForUser(guildId, userId, options = {}) {
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

  if (!options.bypassCooldown && profile.lastXpAt) {
    const diff = now - profile.lastXpAt;
    if (diff < COOLDOWN_MS) {
      return { profile, leveledUp: false, xpGained: 0 };
    }
  }

  let xpGain;
  if (typeof options.fixedXp === "number") {
    xpGain = options.fixedXp;
  } else {
    const min = options.minXp ?? 5;
    const max = options.maxXp ?? 15;
    xpGain = randomInt(min, max);
  }

  let newXp = profile.xp + xpGain;
  let newLevel = profile.level;
  let leveledUp = false;

  const needed = 100 * (profile.level + 1);

  if (newXp >= needed) {
    newLevel++;
    leveledUp = true;
  }

  profile = await prisma.levelProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: {
      xp: newXp,
      level: newLevel,
      lastXpAt: now,
    },
  });

  return { profile, leveledUp, xpGained: xpGain };
}

/**
 * Text-message leveling handler
 * - XP only from guild channels
 * - No XP from bots/DMs
 * - Extra XP if the user is currently in voice
 * - Handles level-up announcements + role rewards
 */
async function handleLevelingMessage(message) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const guildId = message.guild.id;
    const userId = message.author.id;

    const member = message.member;
    const inVoice = !!(member && member.voice && member.voice.channelId);

    const { leveledUp, profile } = await awardXpForUser(guildId, userId, {
      minXp: inVoice ? 8 : 5,
      maxXp: inVoice ? 18 : 15,
    });

    if (leveledUp) {
      const level = profile.level;

      // Apply role rewards first
      await applyLevelRewards(message.guild, userId, level);

      await message.channel.send(
        `🎉 <@${userId}> leveled up to **Level ${level}**!`
      );
    }
  } catch (err) {
    console.error("[leveling] handleLevelingMessage error:", err);
  }
}

module.exports = {
  handleLevelingMessage,
  awardXpForUser,
};
