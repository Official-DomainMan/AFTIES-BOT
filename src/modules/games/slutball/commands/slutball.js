const { SlashCommandBuilder } = require("discord.js");

// suggestive & playful, not explicit
const responses = [
  "Ask again… but slower 😏",
  "Yes, but you'll owe me later.",
  "Absolutely. Don't tease.",
  "Mmm… uncertain, try tempting me more.",
  "Only if you behave… or misbehave. Your choice.",
  "That's a yes with tongue.",
  "Probably — and I'll be watching.",
  "Ask tomorrow, I’m still catching my breath.",
  "Bold of you to ask. Bold of me to say yes.",
  "It’s written in the stars… and on your hips.",
  "The answer is yes. The real question is how soon?",
  "I say yes, but I'd like to hear you say please.",
  "Not today, pretty thing.",
  "Of course. Don't play shy now.",
  "I’m more interested in *how* you plan to do that.",
  "Mmhmm. Affirmative in the filthiest way possible.",
  "If you insist… and I hope you do.",
  "Signs point to you needing a drink first.",
  "Yes. Now stop overthinking and go ruin someone.",
  "Only if you put your whole heart (and hips) into it.",
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("slutball")
    .setDescription("Ask the slutty magic 8-ball a question")
    .addStringOption((opt) =>
      opt
        .setName("question")
        .setDescription("What do you want to know?")
        .setRequired(true)
    ),

  async execute(interaction) {
    const question = interaction.options.getString("question", true);
    const answer = responses[Math.floor(Math.random() * responses.length)];

    await interaction.reply({
      content: `❓ **${question}**\n🎱 ${answer}`,
      ephemeral: false,
    });
  },
};
