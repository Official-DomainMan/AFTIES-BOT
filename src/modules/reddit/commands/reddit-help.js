// src/modules/reddit/commands/reddit-help.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reddit-help")
    .setDescription("Show a menu of all Reddit commands."),

  async execute(interaction) {
    try {
      const embed = new EmbedBuilder()
        .setTitle("📡 AFTIES REDDIT HUB")
        .setDescription(
          [
            `Welcome, ${interaction.user}.`,
            "",
            "**Reddit Commands**",
            "`/reddit-top <subreddit> [timeframe] [limit]`",
            "• Grab top posts from a subreddit (timeframe like: day, week, month, year, all).",
            "",
            "`/reddit-search <query> [subreddit] [sort]`",
            "• Search Reddit posts by keyword, optionally within a specific subreddit.",
            "",
            "`/reddit-user <username> [sort]`",
            "• Peek a user's recent posts or comments.",
            "",
            "`/reddit-random-nsfw [subreddit]`",
            "• Pull a random spicy post. Entire server is already NSFW-enabled.",
            "",
            "**Tips**",
            "• Reddit content can be chaotic, cursed, or both.",
            "• If something fails, the post may be deleted, private, or rate-limited.",
          ].join("\n"),
        )
        .setColor(0xff4500) // Reddit orange-ish
        .setFooter({ text: "Scroll responsibly. Be unhinged respectfully." })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[reddit-help] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error showing Reddit help menu.",
          ephemeral: true,
        });
      }
    }
  },
};
