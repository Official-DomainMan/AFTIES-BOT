const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { searchPosts, normalizeSubreddit } = require("../fetcher");

function pickListingPosts(listing) {
  const children = listing?.data?.children || [];
  return children.map((c) => c.data).filter(Boolean);
}

function isLikelyImageUrl(url) {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url);
}

function buildPostEmbed(post, { titlePrefix = "🔎 Reddit — Search" } = {}) {
  const title = post.title?.slice(0, 256) || "Untitled";
  const url = `https://www.reddit.com${post.permalink}`;
  const subreddit = post.subreddit_name_prefixed || `r/${post.subreddit}`;
  const author = post.author ? `u/${post.author}` : "unknown";
  const upvotes = post.ups ?? 0;
  const comments = post.num_comments ?? 0;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setURL(url)
    .setColor(0x3498db)
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
    .setName("reddit-search")
    .setDescription("Search Reddit posts by keyword.")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("Search query / keywords")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("subreddit")
        .setDescription(
          "Optional subreddit (without r/); search all if omitted",
        )
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("sort")
        .setDescription("Sort order")
        .addChoices(
          { name: "relevance", value: "relevance" },
          { name: "hot", value: "hot" },
          { name: "top", value: "top" },
          { name: "new", value: "new" },
          { name: "comments", value: "comments" },
        )
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("count")
        .setDescription("How many results (1–5). Default: 3")
        .setMinValue(1)
        .setMaxValue(5)
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const query = interaction.options.getString("query", true);
      const subredditRaw = interaction.options.getString("subreddit");
      const sort = interaction.options.getString("sort") || "relevance";
      const count = interaction.options.getInteger("count") || 3;

      const subreddit = subredditRaw ? normalizeSubreddit(subredditRaw) : null;

      const listing = await searchPosts(
        query,
        subreddit,
        sort,
        Math.max(count, 5),
      );
      const posts = pickListingPosts(listing)
        .filter((p) => !p.stickied)
        .filter((p) => !p.removed_by_category);

      if (!posts.length) {
        return interaction.editReply(
          "No results found. Try different keywords.",
        );
      }

      const chosen = posts.slice(0, Math.min(count, 5));
      const embeds = chosen.map((p) =>
        buildPostEmbed(p, { titlePrefix: "🔎 Reddit — Search" }),
      );

      return interaction.editReply({ embeds });
    } catch (err) {
      console.error("[reddit-search] fetch error:", err);
      const msg = String(err?.message || "").includes("status 403")
        ? "Reddit blocked this request (403). If you’re on Railway, enable OAuth env vars for Reddit to fix it."
        : "Error fetching Reddit search. Try again in a minute.";
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: `❌ ${msg}` });
      }
      return interaction.reply({ content: `❌ ${msg}`, ephemeral: true });
    }
  },
};
