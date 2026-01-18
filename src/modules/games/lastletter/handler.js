// src/modules/games/lastletter/handler.js
const { prisma } = require("../../../core/database");

/**
 * We track the last *valid* player per guild+channel in memory.
 * Key: `${guildId}:${channelId}` -> userId
 */
const lastPlayerByChannel = new Map();

// Simple points -> emoji mapping for reactions
function getPointsEmoji(len) {
  if (len === 4) return "4️⃣";
  if (len === 5) return "5️⃣";
  if (len === 6) return "6️⃣";
  if (len >= 7) return "7️⃣";
  return "✨";
}

// Basic word cleaning: letters only, lowercase
function normalizeWord(raw) {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return cleaned.length ? cleaned : null;
}

// For invalid plays: react ❌ and delete shortly after
async function handleInvalidPlay(message, reason) {
  try {
    console.log("[lastletter-invalid]", {
      guildId: message.guild?.id,
      channelId: message.channel?.id,
      userId: message.author?.id,
      reason,
      content: message.content,
    });

    try {
      await message.react("❌");
    } catch (e) {
      console.warn("[lastletter] failed to react ❌:", e);
    }

    // delete after a short delay so users *see* the X briefly
    setTimeout(() => {
      message
        .delete()
        .catch((err) =>
          console.warn("[lastletter] failed to delete invalid message:", err)
        );
    }, 1500);
  } catch (err) {
    console.error("[lastletter] handleInvalidPlay wrapper error:", err);
  }
}

/**
 * Main last-letter handler.
 * Called from src/events/messageCreate.js as handleLastLetterMessage(message)
 */
async function handleLastLetterMessage(message) {
  try {
    // Ignore bots / DMs
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const channelId = message.channel.id;

    const rawWord = message.content;
    const word = normalizeWord(rawWord);

    if (!word) return; // ignore messages that aren't plain-ish words

    // Load state for this guild
    const state = await prisma.lastLetterState.findUnique({
      where: { guildId },
    });

    // If no state or this channel isn't the active last-letter channel, ignore
    if (!state || state.channelId !== channelId) return;

    // Debug log for you
    console.log("[lastletter-debug] state:", {
      guildId: state.guildId,
      channelId: state.channelId,
      lastWord: state.lastWord,
      lastLetter: state.lastLetter,
      currentStreak: state.currentStreak,
      bestStreak: state.bestStreak,
    });

    console.log("[lastletter-debug] message:", {
      authorId: message.author.id,
      word,
    });

    const key = `${guildId}:${channelId}`;
    const isFirstTurn = !state.lastWord || state.lastWord.length === 0;

    // 🔒 Don't allow the same user to play two valid words in a row,
    // but ONLY after the game has started (i.e., not on the very first word).
    if (!isFirstTurn) {
      const lastPlayerId = lastPlayerByChannel.get(key);
      if (lastPlayerId === message.author.id) {
        await handleInvalidPlay(message, "same-user-twice");
        return;
      }
    }

    // ✅ Validate the word against rules

    // 1) If it's NOT the first turn, check starting letter matches last required letter
    if (!isFirstTurn) {
      const expectedFirst = (
        state.lastLetter ||
        state.lastWord[state.lastWord.length - 1] ||
        ""
      ).toLowerCase();

      if (!expectedFirst || word[0] !== expectedFirst) {
        await handleInvalidPlay(message, "wrong-start-letter");
        return;
      }
    }

    // 2) Check that the word hasn't been used already
    const alreadyUsed = state.usedWords.includes(word);
    if (alreadyUsed) {
      await handleInvalidPlay(message, "reused-word");
      return;
    }

    // At this point, the play is VALID 🎉

    const lastChar = word[word.length - 1];
    const pointsEmoji = getPointsEmoji(word.length);

    // React to the *message* — do NOT delete it
    try {
      await message.react("✅");
      await message.react(pointsEmoji);
    } catch (e) {
      console.warn("[lastletter] failed to add reactions:", e);
    }

    // Update streak: +1 per valid word
    const newCurrentStreak = (state.currentStreak || 0) + 1;
    const newBestStreak = Math.max(state.bestStreak || 0, newCurrentStreak);

    // Update DB state
    await prisma.lastLetterState.update({
      where: { guildId },
      data: {
        lastWord: word,
        lastLetter: lastChar,
        usedWords: {
          push: word,
        },
        currentStreak: newCurrentStreak,
        bestStreak: newBestStreak,
      },
    });

    // Remember who played last for this channel (for the "no double turn" rule)
    lastPlayerByChannel.set(key, message.author.id);

    console.log("[lastletter-debug] updated state:", {
      guildId,
      channelId,
      lastWord: word,
      lastLetter: lastChar,
      currentStreak: newCurrentStreak,
      bestStreak: newBestStreak,
      lastPlayerId: message.author.id,
    });
  } catch (err) {
    console.error("[lastletter] handleLastLetterMessage error:", err);
    // No reply here; it's a passive message-based game.
  }
}

module.exports = {
  handleLastLetterMessage,
};
