// src/modules/leveling/voice.js
const { addXpForUser } = require("./handler");

// ============================
// VOICE XP CONFIG
// ============================

// Minimum session length to get XP (in ms)
const MIN_SESSION_MS = 60_000; // 1 minute

// XP per full minute of valid voice time
const XP_PER_MINUTE = 4;

// Maximum minutes counted per single session (anti-afk farm)
const MAX_SESSION_MINUTES = 120; // 2 hours

// Require at least this many non-bot members in the channel
const MIN_MEMBERS_FOR_XP = 2;

// In-memory active voice sessions: key = `${guildId}:${userId}`
const activeSessions = new Map();

/**
 * Check if a given VoiceState is eligible for XP.
 * - Must be in a voice channel
 * - Not muted/deafened (self or server)
 */
function isRewardableState(state) {
  if (!state) return false;
  if (!state.channelId) return false;

  if (state.selfMute || state.selfDeaf) return false;
  if (state.serverMute || state.serverDeaf) return false;

  return true;
}

/**
 * Payout XP for a finished voice session.
 */
async function payoutForSession(
  client,
  guildId,
  userId,
  joinedAt,
  leftAt,
  channelId,
) {
  try {
    if (!joinedAt || !leftAt) return;

    const durationMs = leftAt.getTime() - joinedAt.getTime();
    if (durationMs < MIN_SESSION_MS) {
      return; // too short, ignore
    }

    const minutesRaw = Math.floor(durationMs / 60_000);
    const minutes = Math.min(minutesRaw, MAX_SESSION_MINUTES);

    // Make sure channel still exists & count real humans
    const channel =
      client.channels.cache.get(channelId) ||
      (await client.channels.fetch(channelId).catch(() => null));

    if (!channel || !channel.isVoiceBased()) return;

    let eligibleCount = 0;
    for (const member of channel.members.values()) {
      if (member.user.bot) continue;
      if (
        member.voice.selfDeaf ||
        member.voice.selfMute ||
        member.voice.serverDeaf ||
        member.voice.serverMute
      ) {
        continue;
      }
      eligibleCount++;
    }

    // Require at least MIN_MEMBERS_FOR_XP humans
    if (eligibleCount < MIN_MEMBERS_FOR_XP) {
      return;
    }

    const xpAmount = minutes * XP_PER_MINUTE;

    await addXpForUser(guildId, userId, xpAmount, client);
  } catch (err) {
    console.error("[leveling] payoutForSession error:", err);
  }
}

/**
 * Main voice leveling handler – wired to voiceStateUpdate event.
 */
async function handleVoiceStateUpdate(oldState, newState) {
  try {
    const client = newState.client || oldState.client;
    const guild = newState.guild || oldState.guild;
    if (!client || !guild) return;

    const guildId = guild.id;
    const userId = newState.id || oldState.id;

    const member = newState.member || oldState.member;
    if (member?.user?.bot) return;

    const key = `${guildId}:${userId}`;
    const now = new Date();

    const oldRewardable = isRewardableState(oldState);
    const newRewardable = isRewardableState(newState);

    const hadSession = activeSessions.has(key);

    // 🔹 CASE 1: Start of a rewardable session
    if (!hadSession && newRewardable) {
      activeSessions.set(key, {
        joinedAt: now,
        channelId: newState.channelId,
      });
      return;
    }

    // 🔹 CASE 2: End or transition of a rewardable session
    if (hadSession) {
      const session = activeSessions.get(key);

      const channelIdBefore = oldState.channelId;
      const channelIdAfter = newState.channelId;

      const channelChanged = channelIdBefore !== channelIdAfter;

      // If user left / became non-rewardable / changed channels,
      // we close the previous session and optionally start a new one.
      if (!newRewardable || channelChanged) {
        activeSessions.delete(key);

        const payoutChannelId = channelIdBefore || channelIdAfter;
        if (payoutChannelId) {
          await payoutForSession(
            client,
            guildId,
            userId,
            session.joinedAt,
            now,
            payoutChannelId,
          );
        }

        // If they are still rewardable in a new channel, start a fresh session
        if (newRewardable && channelIdAfter) {
          activeSessions.set(key, {
            joinedAt: now,
            channelId: channelIdAfter,
          });
        }

        return;
      }
    }

    // If none of the above, no-op
  } catch (err) {
    console.error("[leveling] handleVoiceStateUpdate error:", err);
  }
}

module.exports = {
  handleVoiceStateUpdate,
};
