const { prisma } = require("../../../core/database");
const { isValidWord, getLastLetter } = require("./validator");

async function handleLastLetter(message) {
  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content.trim().toLowerCase();

  const state = await prisma.lastLetterState.findUnique({
    where: { guildId: message.guild.id },
  });

  if (!state) return;
  if (message.channel.id !== state.channelId) return;

  // ❌ spaces not allowed
  if (content.includes(" ")) {
    console.log("[lastletter] delete (space):", message.channel.id, content);
    await message.delete().catch(() => {});
    return;
  }

  // ❌ only letters allowed
  if (!isValidWord(content)) {
    console.log(
      "[lastletter] delete (not a word):",
      message.channel.id,
      content
    );
    await message.delete().catch(() => {});
    return;
  }

  // ❌ reused word
  if (state.usedWords.includes(content)) {
    console.log("[lastletter] delete (reused):", message.channel.id, content);
    await message.delete().catch(() => {});
    return;
  }

  // ❌ wrong starting letter
  if (state.lastLetter && content[0] !== state.lastLetter) {
    console.log(
      "[lastletter] delete (wrong letter):",
      message.channel.id,
      content,
      "expected:",
      state.lastLetter
    );
    await message.delete().catch(() => {});
    return;
  }

  // ✅ valid move
  await prisma.lastLetterState.update({
    where: { guildId: message.guild.id },
    data: {
      lastWord: content,
      lastLetter: getLastLetter(content),
      usedWords: { push: content },
    },
  });
}

module.exports = { handleLastLetter };
