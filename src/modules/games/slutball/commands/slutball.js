// src/modules/games/slutball/commands/slutball.js
const { SlashCommandBuilder } = require("discord.js");

const responses = [
  "Absolutely, and she’s not ready. 😈",
  "If you don’t, I will. 👀",
  "Yes, but only if you’re a good slut about it.",
  "Outlook: down bad and getting worse. 🔥",
  "She’s thinking about it more than she’ll admit.",
  "Double text. Triple text. Be shameless. 📱",
  "The answer is yes, but be messy about it.",
  "She wants you to, she just likes pretending she doesn’t.",
  "That’s a ‘ruin her focus for the rest of the day’ yes.",
  "Spirit says: sit on their mind first, then their face.",
  "If you have to ask, you already know it’s filthy. 💋",
  "Goon green light. Proceed with caution and lube.",
  "Yup. And you’re not getting any sleep after.",
  "No, but you’re still gonna try, aren’t you?",
  "She’s obsessed. You’re the problem and the reward.",
  "Ask again later, I’m still recovering from the last round.",
  "It’s giving: **bad decisions, great memories.**",
  "Universe says: send the text. Not the safe one.",
  "They need it. You want it. Sounds fair to me.",
  "Yes, but only if you promise to be unholy about it.",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slutball")
    .setDescription("Ask the Slutball a question and get a filthy answer.")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("What do you want to ask Slutball?")
        .setRequired(true)
    ),

  async execute(interaction) {
    const question = interaction.options.getString("question", true);
    const choice = responses[Math.floor(Math.random() * responses.length)];

    await interaction.reply({
      content: `🎱 **Slutball**\n❓ ${question}\n💦 ${choice}`,
    });
  },
};
