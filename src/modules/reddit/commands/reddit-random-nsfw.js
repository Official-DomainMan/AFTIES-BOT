const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getHot, normalizeSubreddit } = require("../fetcher");

// A curated list so it doesn't pick dead subs.
// You can add/remove freely.
const NSFW_SUBS = [
  "nsfw",
  "gonewild",
  "RealGirls",
  "LegalTeens",
  "adorableporn",
  "Rule34",
  "Blowjobs",
  "ass",
  "boobs",
  "pussy",
  "cumsluts",
  "nsfw_gifs",
  "onoff",
  "milf",
  "petite",
  "bigass",
  "bigboobs",
  "amateur",
  "collegesluts",
];

function pickListingPosts(listing) {
  const children = listing?.data?.children || [];
  return children.map((c) => c.data).filter(Boolean);
}

function isLikelyImageUrl(url) {
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(url);
}

function buildPostEmbed(
  post,
  { titlePrefix = "🔞 Reddit — Random NSFW" } = {},
) {
  const title = post.title?.slice(0, 256) || "Untitled";
  const url = `https://www.reddit.com${post.permalink}`;
  const subreddit = post.subreddit_name_prefixed || `r/${post.subreddit}`;
  const author = post.author ? `u/${post.author}` : "unknown";
  const upvotes = post.ups ?? 0;
  const comments = post.num_comments ?? 0;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setURL(url)
    .setColor(0xe74c3c)
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
    .setFooter({ text: "Source: Reddit (NSFW)" })
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
    .setName("reddit-random-nsfw")
    .setDescription("Pull a random NSFW post from a random NSFW subreddit."),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      // Pick random NSFW sub, then random post from Hot
      const sub = NSFW_SUBS[Math.floor(Math.random() * NSFW_SUBS.length)];
      const subreddit = normalizeSubreddit(sub);

      const listing = await getHot(subreddit, 75);
      const posts = pickListingPosts(listing)
        .filter((p) => !p.stickied)
        .filter((p) => !p.removed_by_category)
        .filter((p) => p.over_18 === true); // force NSFW

      if (!posts.length) {
        return interaction.editReply("No NSFW posts found (try again).");
      }

      const choice = posts[Math.floor(Math.random() * posts.length)];
      const embed = buildPostEmbed(choice, {
        titlePrefix: "🔞 Reddit — Random NSFW",
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[reddit-random-nsfw] fetch error:", err);
      const msg = String(err?.message || "").includes("status 403")
        ? "Reddit blocked this request (403). If you’re on Railway, enable OAuth env vars for Reddit to fix it."
        : "Error fetching Reddit NSFW. Try again in a minute.";
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: `❌ ${msg}` });
      }
      return interaction.reply({ content: `❌ ${msg}`, ephemeral: true });
    }
  },
};
