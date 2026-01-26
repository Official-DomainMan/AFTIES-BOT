// src/modules/games/counting/handler.js
const { prisma } = require("../../../core/database");

/**
 * Handle a counting message in the configured counting channel.
 * - Only works if there's a CountingState row for this guild+channel.
 * - Requires the next correct integer.
 * - DOES NOT allow the same user to count twice in a row.
 * - Deletes bad messages and leaves state untouched.
 */
async function handleCountingMessage(message) {
  try {
    if (!message.guild) return; // ignore DMs
    if (message.author.bot) return; // ignore bots

    const guildId = message.guild.id;
    const channelId = message.channel.id;
    const authorId = message.author.id;

    // Look up counting state for THIS channel.
    const state = await prisma.countingState.findUnique({
      where: {
        guildId_channelId: {
          guildId,
          channelId,
        },
      },
    });

    // If this channel is not configured for counting, bail.
    if (!state) {
      // console.debug("[counting][DEBUG] no state for channel, ignoring");
      return;
    }

    // Basic debug if you want:
    // console.debug("[counting-debug] state:", state);
    // console.debug("[counting-debug] message:", {
    //   authorId,
    //   content: message.content,
    // });

    // Require a pure integer in the message
    const raw = message.content.trim();
    const num = Number(raw);

    // Not an integer? Just delete and bail.
    if (!Number.isInteger(num)) {
      try {
        await message.delete().catch(() => {});
      } catch {}
      return;
    }

    const expected = state.current + 1;

    // RULE 1: No double counts by same user
    if (state.lastUserId && state.lastUserId === authorId) {
      // Same user as last valid counter – reject.
      // Optionally react then delete so it's clear
      try {
        await message.react("❌").catch(() => {});
      } catch {}

      try {
        await message.delete().catch(() => {});
      } catch {}

      // console.debug("[counting-debug] rejected (same user twice in a row)");
      return;
    }

    // RULE 2: Must be exactly +1
    if (num !== expected) {
      // Wrong number – delete and do NOT change the state.
      try {
        await message.react("❌").catch(() => {});
      } catch {}

      try {
        await message.delete().catch(() => {});
      } catch {}

      // console.debug("[counting-debug] rejected (expected", expected, "got", num, ")");
      return;
    }

    // At this point, message is valid.
    const newCurrent = num;

    const updated = await prisma.countingState.update({
      where: {
        guildId_channelId: {
          guildId,
          channelId,
        },
      },
      data: {
        current: newCurrent,
        lastUserId: authorId,
      },
    });

    // console.debug("[counting-debug] accepted:", {
    //   num,
    //   newCurrent: updated.current,
    //   userId: authorId,
    // });

    // Optional ✅ reaction on success
    try {
      await message.react("✅").catch(() => {});
    } catch {
      // ignore reaction errors
    }
  } catch (err) {
    console.error("[messageCreate:counting] error:", err);
  }
}

module.exports = {
  handleCountingMessage,
};
