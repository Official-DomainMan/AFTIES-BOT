// src/modules/games/lastletter/handler.js
const { prisma } = require("../../../core/database");

/**
 * Send a short warning message and delete it after a few seconds.
 */
async function softWarn(channel, text) {
  try {
    const msg = await channel.send(text);
    setTimeout(() => msg.delete().catch(() => {}), 5000);
  } catch {
    // ignore
  }
}

/**
 * Handle the Last Letter word game.
 *
 * Rules (simple version):
 * - Only runs in the configured channel for this guild
 * - Only accepts single-word messages, letters only
 * - First word can be anything
 * - After that, each word must start with the last letter of the previous word
 * - Word cannot be reused (case-insensitive)
 * - ✅ reaction for valid words, ❌ for invalid ones
 */
async function handleLastLetter(message) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const guildId = message.guild.id;

  // Load state for this guild
  const state = await prisma.lastLetterState.findUnique({
    where: { guildId },
  });

  if (!state) return; // game not set up for this guild

  // Only act in the configured channel
  if (message.channel.id !== state.channelId) return;

  const raw = message.content.trim();

  // Only allow a single "word" – no spaces
  const parts = raw.split(/\s+/);
  if (parts.length !== 1) {
    await message.delete().catch(() => {});
    await softWarn(
      message.channel,
      "❌ One word at a time, baby. No spaces allowed."
    );
    return;
  }

  const word = parts[0].toLowerCase();

  // Only letters, at least 2 chars to keep it fun
  if (!/^[a-z]+$/.test(word) || word.length < 2) {
    await message.delete().catch(() => {});
    await softWarn(message.channel, "❌ Letters only, at least 2 characters.");
    return;
  }

  // Check word reuse
  const used = state.usedWords || [];
  if (used.includes(word)) {
    await message.delete().catch(() => {});
    await softWarn(
      message.channel,
      "❌ That word's already been used. Pick another."
    );
    return;
  }

  // If this is not the first word, enforce last-letter rule
  if (state.lastWord && state.lastWord.length > 0) {
    const expectedFirst = (
      state.lastLetter || state.lastWord[state.lastWord.length - 1]
    ).toLowerCase();
    const actualFirst = word[0].toLowerCase();

    if (actualFirst !== expectedFirst) {
      await message.delete().catch(() => {});
      await softWarn(
        message.channel,
        `❌ Wrong starting letter. Your word must start with **${expectedFirst.toUpperCase()}**.`
      );
      return;
    }
  }

  // If we get here, the word is valid → react ✅ and update state
  try {
    await message.react("✅").catch(() => {});

    const lastLetter = word[word.length - 1];

    await prisma.lastLetterState.update({
      where: { guildId },
      data: {
        lastWord: word,
        lastLetter,
        usedWords: {
          push: word,
        },
      },
    });
  } catch (err) {
    console.error("[lastletter] error updating state:", err);
    // Don't delete the message if DB fails; just soft-warn
    await softWarn(
      message.channel,
      "⚠️ Word accepted, but I couldn't save the game state. Tell my dev."
    );
  }
}

module.exports = { handleLastLetter };
