// src/modules/leveling/voice.js
const { addXpForUser } = require("./handler");

// ============================
// CONFIG
// ============================

// XP per full minute in voice
const VOICE_XP_PER_MINUTE = 4;

// Minimum session length to award XP (seconds)
const MIN_SESSION_SECONDS = 60;

// Hard cap on countable minutes from one session
const MAX_SESSION_MINUTES = 120;

// Active VC sessions keyed by "guildId:userId"
const activeVoiceSessions = new Map();

/**
 * Build a unique key for a voice session.
 */
function makeSessionKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

/**
 * Payout XP for a stored voice session, then remove it.
 */
async function payoutForSession(sessionKey, client) {
  const session = activeVoiceSessions.get(sessionKey);
  if (!session) return;

  const { guildId, userId, joinedAt, channelId } = session;

  if (!guildId || !userId || !joinedAt) {
    console.warn("[leveling] payoutForSession missing data:", {
      guildId,
      userId,
      joinedAt,
      channelId,
    });
    activeVoiceSessions.delete(sessionKey);
    return;
  }

  const now = Date.now();
  const elapsedSeconds = Math.floor((now - joinedAt.getTime()) / 1000);

  if (elapsedSeconds < MIN_SESSION_SECONDS) {
    console.log("[leveling] voice session too short, no XP:", {
      guildId,
      userId,
      elapsedSeconds,
    });
    activeVoiceSessions.delete(sessionKey);
    return;
  }

  const minutes = Math.min(
    Math.floor(elapsedSeconds / 60),
    MAX_SESSION_MINUTES,
  );

  // Basic anti-AFK: if they were self-muted (or server muted) when we stored the session,
  // you could choose to zero out XP. For now, we just log it.
  if (session.selfMuted || session.selfDeafened || session.serverMuted) {
    console.log(
      "[leveling] voice session muted/deafened, still awarding XP but logged:",
      {
        guildId,
        userId,
        minutes,
        selfMuted: session.selfMuted,
        selfDeafened: session.selfDeafened,
        serverMuted: session.serverMuted,
      },
    );
  }

  const amount = minutes * VOICE_XP_PER_MINUTE;

  try {
    console.log("[leveling] payoutForSession awarding voice XP:", {
      guildId,
      userId,
      minutes,
      amount,
    });

    await addXpForUser({
      guildId,
      userId,
      amount,
      client,
      source: "voice",
    });
  } catch (err) {
    console.error("[leveling] payoutForSession error:", err);
  } finally {
    activeVoiceSessions.delete(sessionKey);
  }
}

/**
 * Main handler hooked from src/events/voiceStateUpdate.js
 */
async function handleVoiceStateUpdate(oldState, newState) {
  try {
    const member = newState.member ?? oldState.member;
    if (!member) return;
    if (member.user.bot) return;

    const guildId = newState.guild?.id ?? oldState.guild?.id;
    const userId = member.id;

    if (!guildId || !userId) {
      console.warn("[leveling] voice update missing guildId/userId:", {
        guildId,
        userId,
      });
      return;
    }

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;
    const sessionKey = makeSessionKey(guildId, userId);

    // Helpful debug
    // console.log("[leveling] voice update:", {
    //   guildId,
    //   userId,
    //   oldChannelId,
    //   newChannelId,
    // });

    // 1) User left VC entirely
    if (oldChannelId && !newChannelId) {
      console.log(
        "[leveling] voice: user left VC, paying out if any session exists:",
        {
          guildId,
          userId,
          oldChannelId,
        },
      );
      await payoutForSession(sessionKey, newState.client);
      return;
    }

    // 2) User joined VC from nothing
    if (!oldChannelId && newChannelId) {
      activeVoiceSessions.set(sessionKey, {
        guildId,
        userId,
        channelId: newChannelId,
        joinedAt: new Date(),
        selfMuted: newState.selfMute,
        selfDeafened: newState.selfDeaf,
        serverMuted: newState.serverMute,
      });

      console.log("[leveling] voice: session started:", {
        guildId,
        userId,
        channelId: newChannelId,
      });

      return;
    }

    // 3) User moved between channels in same guild
    if (oldChannelId && newChannelId && oldChannelId !== newChannelId) {
      console.log(
        "[leveling] voice: moved channels, paying out old + starting new:",
        {
          guildId,
          userId,
          from: oldChannelId,
          to: newChannelId,
        },
      );

      await payoutForSession(sessionKey, newState.client);

      activeVoiceSessions.set(sessionKey, {
        guildId,
        userId,
        channelId: newChannelId,
        joinedAt: new Date(),
        selfMuted: newState.selfMute,
        selfDeafened: newState.selfDeaf,
        serverMuted: newState.serverMute,
      });

      return;
    }

    // 4) Still in same VC; update mute/deaf flags so we can log accurately
    if (newChannelId && oldChannelId === newChannelId) {
      const existing = activeVoiceSessions.get(sessionKey);
      if (existing) {
        existing.selfMuted = newState.selfMute;
        existing.selfDeafened = newState.selfDeaf;
        existing.serverMuted = newState.serverMute;
        activeVoiceSessions.set(sessionKey, existing);
      }
    }
  } catch (err) {
    console.error("[leveling] handleVoiceStateUpdate error:", err);
  }
}

module.exports = {
  handleVoiceStateUpdate,
};
