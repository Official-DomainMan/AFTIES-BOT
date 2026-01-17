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
 * Curved XP requirement.
 * XP required for NEXT level.
 * Example: lvl 1 -> 125, lvl 2 -> 350, lvl 3 -> 725...
 */
function getRequiredXpForLevel(level) {
  if (level <= 0) return 0;
  // You asked for "slower" pacing, so this is intentionally chunky
  return 50 + level * level * 75;
}

/**
 * Random XP for a message, within configured min/max.
 */
function getRandomMessageXp() {
  const range = MESSAGE_XP_MAX - MESSAGE_XP_MIN + 1;
  return MESSAGE_XP_MIN + Math.floor(Math.random() * range);
}

/**
 * Main leveling handler – called from messageCreate.
 * Currently: message-based XP only.
 */
async function handleLevelingMessage(message) {
  try {
    if (!message.guild) return; // ignore DMs
    if (message.author.bot) return; // ignore bots

    const guildId = message.guild.id;
    const userId = message.author.id;
    const now = new Date();

    // Ensure profile exists
    let profile = await prisma.levelProfile.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
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

    // Cooldown check – no XP if still on cooldown
    if (profile.lastXpAt) {
      const last = new Date(profile.lastXpAt);
      const diff = now.getTime() - last.getTime();
      if (diff < MESSAGE_COOLDOWN_MS) {
        return; // still on cooldown
      }
    }

    const xpGain = getRandomMessageXp();
    let newXp = profile.xp + xpGain;
    let newLevel = profile.level;
    let leveledUp = false;

    // Apply level-ups until XP fits inside the current level's requirement
    while (true) {
      const requiredForNext = getRequiredXpForLevel(newLevel + 1);
      if (requiredForNext <= 0) break;

      if (newXp >= requiredForNext) {
        newXp -= requiredForNext;
        newLevel += 1;
        leveledUp = true;
      } else {
        break;
      }
    }

    // Persist updated profile
    profile = await prisma.levelProfile.update({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      data: {
        xp: newXp,
        level: newLevel,
        lastXpAt: now,
      },
    });

    // If no level-up, we stop here (no spam)
    if (!leveledUp) return;

    // ============================
    // Level-up announcement
    // ============================
    // Try to respect a level-up channel setting if it exists
    let targetChannelId = message.channel.id;

    try {
      const settings = await prisma.levelSettings.findUnique({
        where: { guildId },
      });

      if (settings && settings.levelUpChannelId) {
        targetChannelId = settings.levelUpChannelId;
      }
    } catch (err) {
      // If settings table doesn’t exist or something is off, just ignore
      console.warn("[leveling] levelSettings lookup failed:", err.message);
    }

    const channel =
      message.client.channels.cache.get(targetChannelId) ??
      (await message.client.channels.fetch(targetChannelId).catch(() => null));

    if (!channel || !channel.isTextBased()) return;

    const userMention = `<@${userId}>`;
    const embed = new EmbedBuilder()
      .setTitle("⬆️ Level Up!")
      .setDescription(`${userMention} just reached **level ${newLevel}**`)
      .setColor(0x2ecc71)
      .setFooter({ text: "Keep talking your shit." })
      .setTimestamp();

    // Send the announcement in the chosen channel
    await channel.send({ embeds: [embed] }).catch(() => {});

    // Add a subtle reaction on the user’s message (optional flex)
    try {
      await message.react("⬆️");
    } catch {
      // ignore reaction errors (missing perms, etc.)
    }
  } catch (err) {
    console.error("[leveling] handleLevelingMessage error:", err);
  }
}

module.exports = {
  handleLevelingMessage,
  getRequiredXpForLevel,
};
