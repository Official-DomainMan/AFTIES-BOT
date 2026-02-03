const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getHot, normalizeSubreddit } = require("../fetcher");

function pickListingPosts(listing) {
  const children = listing?.data?.children || [];
  return children.map((c) => c.data).filter(Boolean);
}

function isLikelyImageUrl(url) {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url);
}

function buildPostEmbed(post, { titlePrefix = "🎲 Reddit — Random" } = {}) {
  const title = post.title?.slice(0, 256) || "Untitled";
  const url = `https://www.reddit.com${post.permalink}`;
  const subreddit = post.subreddit_name_prefixed || `r/${post.subreddit}`;
  const author = post.author ? `u/${post.author}` : "unknown";
  const upvotes = post.ups ?? 0;
  const comments = post.num_comments ?? 0;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setURL(url)
    .setColor(0x9b59b6)
    .setAuthor({ name: `${titlePrefix} • ${subreddit}` })
    .setDescription(
      post.selftext
        ? post.selftext.slice(0, 600) + (post.selftext.length > 600 ? "…" : "")
        : "",
    )
    .addFields(
      { name: "Author", value: author, inline: true },
      { name: "Upvotes", value: String(upvotes), inline: true },
      { name: "Comments", value: String(comments), inline: true },
    )
    .setFooter({ text: "Source: Reddit" })
    .setTimestamp();

  const img =
    post.preview?.images?.[0]?.source?.url?.replaceAll("&amp;", "&") ||
    (isLikelyImageUrl(post.url_overridden_by_dest)
      ? post.url_overridden_by_dest
      : null) ||
    null;

  if (img) embed.setImage(img);
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reddit-random")
    .setDescription("Grab a random hot post from a subreddit.")
    .addStringOption((opt) =>
      opt
        .setName("subreddit")
        .setDescription("Subreddit (without r/). Example: memes (or r/memes)")
        .setRequired(true),
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const subredditRaw = interaction.options.getString("subreddit", true);
      const subreddit = normalizeSubreddit(subredditRaw);

      const listing = await getHot(subreddit, 50);
      const posts = pickListingPosts(listing)
        .filter((p) => !p.stickied)
        .filter((p) => !p.removed_by_category);

      if (!posts.length) {
        return interaction.editReply(
          "No posts found. Try a different subreddit.",
        );
      }

      const choice = posts[Math.floor(Math.random() * posts.length)];
      const embed = buildPostEmbed(choice, {
        titlePrefix: "🎲 Reddit — Random",
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[reddit-random] fetch error:", err);
      const msg = String(err?.message || "").includes("status 403")
        ? "Reddit blocked this request (403). If you’re on Railway, enable OAuth env vars for Reddit to fix it."
        : "Error fetching Reddit. Try again in a minute.";
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: `❌ ${msg}` });
      }
      return interaction.reply({ content: `❌ ${msg}`, ephemeral: true });
    }
  },
};
