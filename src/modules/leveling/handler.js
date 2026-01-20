// src/modules/leveling/handler.js
const { EmbedBuilder } = require("discord.js");
const { prisma } = require("../../core/database");

// ============================
// XP CONFIG
// ============================

// Message XP per proc
const MESSAGE_XP_MIN = 4;
const MESSAGE_XP_MAX = 9;

// Cooldown between XP grants per user (ms)
const MESSAGE_COOLDOWN_MS = 90_000; // 1.5 minutes

/**
 * Returns XP required for next level.
 * Curve: slow, intentional — you asked for slower pacing.
 */
function getRequiredXpForLevel(level) {
  if (level <= 0) return 0;
  return 50 + level * level * 75; // quadratic curve
}

/**
 * Random XP chunk for text messages.
 */
function getRandomMessageXp() {
  const range = MESSAGE_XP_MAX - MESSAGE_XP_MIN + 1;
  return MESSAGE_XP_MIN + Math.floor(Math.random() * range);
}

/**
 * Shared helper: add XP to a user, handle level-ups, announce.
 *
 * Used by:
 * - text messages (via handleLevelingMessage)
 * - voice XP (via voice.js)
 *
 * NOTE: No cooldown here. Cooldowns are handled by the caller.
 */
async function addXpForUser({
  guildId,
  userId,
  amount,
  client,
  source = "message", // "message" | "voice" | etc
}) {
  const now = new Date();

  // Ensure profile exists
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

  // Level loop in case a big chunk jumps multiple levels
  while (true) {
    const needed = getRequiredXpForLevel(newLevel + 1);
    if (needed <= 0) break;

    if (newXp >= needed) {
      newXp -= needed;
      newLevel++;
      leveledUp = true;
    } else {
      break;
    }
  }

  profile = await prisma.levelProfile.update({
    where: { guildId_userId: { guildId, userId } },
    data: {
      xp: newXp,
      level: newLevel,
      lastXpAt: now,
    },
  });

  if (!leveledUp) {
    // No level-up, nothing else to do
    return profile;
  }

  // ============================
  // SANITY LOG
  // ============================
  console.log("[leveling] leveled up via", source, {
    guildId,
    userId,
    newLevel,
    newXp,
    amountGained: amount,
  });

  // ============================
  // Announce level-up
  // ============================
  let channelId = null;

  try {
    const settings = await prisma.levelSettings.findUnique({
      where: { guildId },
    });

    if (settings && settings.levelUpChannelId) {
      channelId = settings.levelUpChannelId;
    }
  } catch (e) {
    console.warn("[leveling] levelSettings lookup failed:", e.message);
  }

  // Fallback if no level-up channel configured
  if (!channelId && client) {
    try {
      const guild = await client.guilds.fetch(guildId);
      channelId =
        guild.systemChannelId ||
        guild.rulesChannelId ||
        guild.publicUpdatesChannelId ||
        null;
    } catch {
      // no fallback channel
    }
  }

  if (!channelId || !client) {
    return profile;
  }

  const channel =
    client.channels.cache.get(channelId) ??
    (await client.channels.fetch(channelId).catch(() => null));

  if (!channel || !channel.isTextBased()) return profile;

  const userMention = `<@${userId}>`;
  const sourceLabel = source === "voice" ? "VC" : "chat";

  const embed = new EmbedBuilder()
    .setTitle("⬆️ Level Up!")
    .setDescription(
      `${userMention} just reached **level ${newLevel}** (${sourceLabel} XP)`,
    )
    .setColor(0x2ecc71)
    .setFooter({ text: "Keep talking your shit." })
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});

  return profile;
}

/**
 * Text-message-based leveling entrypoint.
 * This wraps addXpForUser but adds cooldown and message reaction.
 */
async function handleLevelingMessage(message) {
  try {
    if (!message.guild) return;
    if (message.author.bot) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const now = new Date();

    // Fetch profile for cooldown
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

    // Cooldown check
    if (profile.lastXpAt) {
      const last = new Date(profile.lastXpAt);
      const diff = now.getTime() - last.getTime();
      if (diff < MESSAGE_COOLDOWN_MS) {
        return; // still cooling down
      }
    }

    const gainedXp = getRandomMessageXp();

    // Use shared helper so math & announcing are consistent
    const updated = await addXpForUser({
      guildId,
      userId,
      amount: gainedXp,
      client: message.client,
      source: "message",
    });

    // Optional reaction if they actually leveled (compare old / new level)
    if (updated.level > profile.level) {
      try {
        await message.react("⬆️");
      } catch {
        // ignore perms / emoji errors
      }
    }
  } catch (err) {
    console.error("[leveling] handleLevelingMessage error:", err);
  }
}

module.exports = {
  handleLevelingMessage,
  getRequiredXpForLevel,
  addXpForUser,
};
