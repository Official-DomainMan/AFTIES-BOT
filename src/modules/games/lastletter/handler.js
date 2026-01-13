// src/modules/games/lastletter/handler.js
const { prisma } = require("../../../core/database");

/**
 * Soft feedback: react ❌ and optionally send a short message that auto-deletes.
 */
async function softReject(message, reason) {
  try {
    await message.react("❌").catch(() => {});
  } catch {}

  if (!reason) return;

  try {
    const reply = await message.reply(reason);
    setTimeout(() => reply.delete().catch(() => {}), 5000);
  } catch {}
}

/**
 * Soft success reaction (✅) for valid words.
 */
async function softAccept(message) {
  try {
    await message.react("✅").catch(() => {});
  } catch {}
}

/**
 * Main Last Letter handler.
 * - Enforces channel
 * - Enforces alphabetic words
 * - Enforces last-letter chaining
 * - Enforces no re-use of previous words
 * - Awards points (word length) to leaderboard
 * - Tracks streak: currentStreak + bestStreak (global per guild)
 */
async function handleLastLetter(message) {
  // Ignore bots & DMs
  if (message.author.bot) return;
  if (!message.guild) return;

  // Fetch game state for this guild
  const state = await prisma.lastLetterState.findUnique({
    where: { guildId: message.guild.id },
  });

  // Game not configured or wrong channel
  if (!state) return;
  if (message.channel.id !== state.channelId) return;

  const raw = message.content.trim();
  const word = raw.toLowerCase();

  // Basic validation: letters only, at least 2 chars (tweak if you want)
  if (!/^[a-zA-Z]+$/.test(word) || word.length < 2) {
    await message.delete().catch(() => {});
    await softReject(
      message,
      "❌ Letters only, at least 2 characters. Try again."
    );
    return;
  }

  // Check for word reuse
  const used = state.usedWords || [];
  if (used.includes(word)) {
    await message.delete().catch(() => {});
    await softReject(
      message,
      "❌ That word has already been used in this game."
    );
    return;
  }

  // Enforce last-letter chaining if we have a previous word
  if (state.lastWord && state.lastWord.length > 0) {
    const expectedFirst = (
      state.lastLetter ??
      state.lastWord[state.lastWord.length - 1] ??
      ""
    ).toLowerCase();

    if (expectedFirst && word[0] !== expectedFirst) {
      await message.delete().catch(() => {});
      await softReject(
        message,
        `❌ Wrong starting letter. Your word must start with **${expectedFirst.toUpperCase()}**.`
      );
      return;
    }
  }

  // VALID WORD — award points and update streak
  const points = word.length;
  const lastChar = word[word.length - 1];

  // Compute new streak values
  const newCurrent = (state.currentStreak ?? 0) + 1;
  const newBest = Math.max(state.bestStreak ?? 0, newCurrent);

  // Update game state
  await prisma.lastLetterState.update({
    where: { guildId: message.guild.id },
    data: {
      lastWord: word,
      lastLetter: lastChar,
      usedWords: { push: word },
      currentStreak: newCurrent,
      bestStreak: newBest,
    },
  });

  // Update leaderboard (assumes model LastLetterScore with fields: guildId, userId, score)
  try {
    await prisma.lastLetterScore.upsert({
      where: {
        guildId_userId: {
          guildId: message.guild.id,
          userId: message.author.id,
        },
      },
      update: {
        score: { increment: points },
      },
      create: {
        guildId: message.guild.id,
        userId: message.author.id,
        score: points,
      },
    });
  } catch (err) {
    console.error("[lastletter] leaderboard update error:", err);
    // Don't fail the game just because leaderboard had an issue
  }

  // React ✅ on success
  await softAccept(message);
}

module.exports = { handleLastLetter };
