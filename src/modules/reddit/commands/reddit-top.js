const { SlashCommandBuilder } = require("discord.js");
const { fetchListing } = require("../fetcher");
const { postToEmbed } = require("../formatter");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reddit-top")
    .setDescription("Embed the top Reddit post from a subreddit (daily)")
    .addStringOption((o) =>
      o
        .setName("subreddit")
        .setDescription("Example: memes (or r/memes)")
        .setRequired(true)
    ),

  async execute(interaction) {
    // ACK ASAP so Discord doesn't show "did not respond"
    try {
      await interaction.deferReply();
    } catch (e) {
      // If defer fails, we can't do much else
      console.error("deferReply failed:", e);
      return;
    }

    const subreddit = interaction.options.getString("subreddit", true);

    try {
      const post = await fetchListing(subreddit, "top", 1);

      if (!post) return interaction.editReply("No posts found.");

      if (post.over_18 && !interaction.channel.nsfw) {
        return interaction.editReply(
          "That post is NSFW — use an NSFW channel."
        );
      }

      const embed = postToEmbed(post);
      return interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.error("reddit-top error:", e);
      return interaction.editReply(
        "❌ Reddit didn’t respond in time (or blocked the request). Try again in a minute."
      );
    }
  },
};
