// src/modules/games/lastletter/handler.js
const { prisma } = require("../../../core/database");

// Map points → emoji for quick visual feedback
const numberEmojis = {
  1: "1️⃣",
  2: "2️⃣",
  3: "3️⃣",
  4: "4️⃣",
  5: "5️⃣",
  6: "6️⃣",
  7: "7️⃣",
  8: "8️⃣",
  9: "9️⃣",
  10: "🔟",
};

function getPointsEmoji(points) {
  if (points <= 0) return null;
  if (points <= 10) return numberEmojis[points] || null;
  // Long words just get sparkles
  return "✨";
}

async function softWarn(channel, text) {
  try {
    const msg = await channel.send(text);
    setTimeout(() => msg.delete().catch(() => {}), 7000);
  } catch {
    // ignore
  }
}

async function handleLastLetter(message) {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const guildId = message.guild.id;

    // Load state for this guild
    const state = await prisma.lastLetterState.findUnique({
      where: { guildId },
    });

    if (!state) return; // game not configured
    if (message.channel.id !== state.channelId) return; // wrong channel

    const raw = message.content.trim();
    if (!raw) return;

    // Use first "word" in message as the play
    const word = raw.split(/\s+/)[0];
    const clean = word.toLowerCase();

    console.log("[lastletter-debug] state:", {
      guildId: state.guildId,
      channelId: state.channelId,
      lastLetter: state.lastLetter,
    });
    console.log("[lastletter-debug] message:", {
      authorId: message.author.id,
      word,
    });

    // Only allow pure letters
    if (!/^[a-zA-Z]+$/.test(clean)) {
      await message.react("❌").catch(() => {});
      await softWarn(
        message.channel,
        "❌ Letters only, babe. No spaces, numbers, or symbols."
      );
      console.log("[lastletter-debug] reject: non-letter");
      return;
    }

    // Enforce starting letter if there is a previous lastLetter
    if (state.lastLetter && state.lastLetter.length > 0) {
      const expected = state.lastLetter.toLowerCase();
      const actual = clean[0].toLowerCase();

      if (expected !== actual) {
        await message.react("❌").catch(() => {});
        await softWarn(
          message.channel,
          `❌ Wrong starting letter.\nLast word ended with **${expected.toUpperCase()}**, so your word must start with **${expected.toUpperCase()}**.`
        );
        console.log("[lastletter-debug] reject: wrong starting letter", {
          expected,
          actual,
        });
        return;
      }
    }

    // Valid play 🎉
    const points = clean.length;
    const ptsEmoji = getPointsEmoji(points);

    // React to the message
    try {
      await message.react("✅").catch(() => {});
      if (ptsEmoji) {
        await message.react(ptsEmoji).catch(() => {});
      }
    } catch {
      // ignore reaction failures
    }

    // Update core game state in LastLetterState
    await prisma.lastLetterState.update({
      where: { guildId },
      data: {
        // store the last letter of this word
        lastLetter: clean[clean.length - 1],
        // push word into usedWords array
        usedWords: {
          push: clean,
        },
      },
    });

    // Update leaderboard in LastLetterScore
    await prisma.lastLetterScore.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId: message.author.id,
        },
      },
      update: {
        score: { increment: points },
      },
      create: {
        guildId,
        userId: message.author.id,
        score: points,
      },
    });

    console.log("[lastletter-debug] accepted:", {
      word: clean,
      points,
      userId: message.author.id,
    });
  } catch (err) {
    console.error("[lastletter] handler error:", err);
    // We don't reply in-channel here to keep it silent on failure.
  }
}

module.exports = { handleLastLetter };
