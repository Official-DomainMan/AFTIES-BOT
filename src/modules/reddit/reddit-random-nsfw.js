// src/modules/reddit/commands/reddit-random-nsfw.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

// A small pool of NSFW subs to randomly pull from.
// You can edit this list to match your server's vibe.
const NSFW_SUBS = [
  "nsfw",
  "RealGirls",
  "OnOff",
  "gonewild",
  "ass",
  "boobs",
  "thick",
  "AltGoneWild",
  "NSFW_Snapchat",
  "gwcumsluts",
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getImageFromPost(data) {
  const url = data.url_overridden_by_dest || data.url || "";
  if (
    url.endsWith(".jpg") ||
    url.endsWith(".jpeg") ||
    url.endsWith(".png") ||
    url.endsWith(".gif")
  ) {
    return url;
  }

  if (data.preview && data.preview.images && data.preview.images[0]) {
    const source = data.preview.images[0].source;
    if (source && source.url) return source.url.replace(/&amp;/g, "&");
  }

  return null;
}

function buildEmbedFromPost(post) {
  const subreddit = post.subreddit || "unknown";
  const url = `https://reddit.com${post.permalink}`;
  const imageUrl = getImageFromPost(post);

  const embed = new EmbedBuilder()
    .setTitle(post.title?.slice(0, 256) || "Random NSFW Reddit Post")
    .setURL(url)
    .setColor(0xff0069)
    .setFooter({
      text: `r/${subreddit} • u/${post.author || "unknown"} • 👍 ${
        post.ups ?? 0
      } • 💬 ${post.num_comments ?? 0}`,
    })
    .setTimestamp(
      post.created_utc ? new Date(post.created_utc * 1000) : new Date(),
    );

  if (post.selftext && post.selftext.trim().length > 0) {
    const desc =
      post.selftext.length > 1800
        ? post.selftext.slice(0, 1800) + "…"
        : post.selftext;
    embed.setDescription(desc);
  }

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reddit-random-nsfw")
    .setDescription("Pull a random NSFW post from a random NSFW subreddit."),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      const subreddit = getRandomItem(NSFW_SUBS);

      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("include_over_18", "on");

      const url = `https://www.reddit.com/r/${encodeURIComponent(
        subreddit,
      )}/hot.json?${params.toString()}`;

      let json;

      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "AFTIES-BOT/1.0 (Discord bot)",
          },
        });

        if (!res.ok) {
          throw new Error(
            `Reddit responded with status ${res.status} for r/${subreddit}`,
          );
        }

        json = await res.json();
      } catch (err) {
        console.error("[reddit-random-nsfw] fetch error:", err);
        return interaction.editReply({
          content: `❌ Failed to fetch from r/${subreddit}. Reddit might be rate limiting or that sub is acting up.`,
        });
      }

      if (
        !json ||
        !json.data ||
        !Array.isArray(json.data.children) ||
        json.data.children.length === 0
      ) {
        return interaction.editReply({
          content: `⚠️ No posts found in r/${subreddit}. Try again.`,
        });
      }

      // Explicitly require over_18; no safe-for-work allowed here.
      const posts = json.data.children
        .map((c) => c.data)
        .filter((p) => p.over_18 && !p.stickied);

      if (!posts.length) {
        return interaction.editReply({
          content: `⚠️ No usable NSFW posts found in r/${subreddit} right now. Try again.`,
        });
      }

      const post = getRandomItem(posts);
      const embed = buildEmbedFromPost(post);

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[reddit-random-nsfw] error:", err);
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: "❌ Error running /reddit-random-nsfw.",
        });
      } else if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: "❌ Error running /reddit-random-nsfw.",
          ephemeral: true,
        });
      }
    }
  },
};
