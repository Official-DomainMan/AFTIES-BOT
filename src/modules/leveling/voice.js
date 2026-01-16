// src/modules/leveling/voice.js
const { awardXpForUser } = require("./handler");
const { applyLevelRewards } = require("./rewards");

// key: `${guildId}:${userId}` → timestamp (ms)
const joinTimes = new Map();

function keyFor(guildId, userId) {
  return `${guildId}:${userId}`;
}

/**
 * Gives XP based on how long a user was in VC.
 *
 * - Called on voiceStateUpdate
 * - Awards XP on:
 *    • leaving VC
 *    • switching voice channels
 * - 10 XP per minute, capped per session
 */
async function handleVoiceStateUpdate(oldState, newState) {
  try {
    const guild = newState.guild ?? oldState.guild;
    if (!guild) return;

    const userId = newState.id;
    const guildId = guild.id;

    const member = newState.member ?? oldState.member;
    if (member?.user?.bot) return;

    const wasIn = !!oldState.channelId;
    const isIn = !!newState.channelId;

    const key = keyFor(guildId, userId);

    const payoutForSession = async (joinedAtMs) => {
      if (!joinedAtMs) return;
      const minutes = Math.floor((Date.now() - joinedAtMs) / 60000);
      if (minutes <= 0) return;

      // Cap to avoid absurd AFK sessions farming XP
      const capped = Math.min(minutes, 240); // max 4 hours per session
      const xp = capped * 10; // 10 XP per minute

      const { leveledUp, profile } = await awardXpForUser(guildId, userId, {
        fixedXp: xp,
        bypassCooldown: true,
      });

      if (leveledUp) {
        await applyLevelRewards(guild, userId, profile.level);
      }
    };

    // Joined a voice channel
    if (!wasIn && isIn) {
      joinTimes.set(key, Date.now());
      return;
    }

    // Left voice entirely
    if (wasIn && !isIn) {
      const joinedAt = joinTimes.get(key);
      joinTimes.delete(key);
      await payoutForSession(joinedAt);
      return;
    }

    // Switched between voice channels — treat as leave + join
    if (wasIn && isIn && oldState.channelId !== newState.channelId) {
      const joinedAt = joinTimes.get(key);
      joinTimes.set(key, Date.now());
      await payoutForSession(joinedAt);
    }
  } catch (err) {
    console.error("[leveling] handleVoiceStateUpdate error:", err);
  }
}

module.exports = { handleVoiceStateUpdate };
