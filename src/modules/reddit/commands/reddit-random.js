// src/modules/reddit/commands/reddit-random.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function buildRedditUrl(subreddit) {
  return `https://www.reddit.com/r/${encodeURIComponent(
    subreddit,
  )}/hot.json?limit=50`;
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

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function buildEmbedFromPost(post, fallbackSubreddit) {
  const subreddit = post.subreddit || fallbackSubreddit;
  const url = `https://reddit.com${post.permalink}`;
  const imageUrl = getImageFromPost(post);

  const embed = new EmbedBuilder()
    .setTitle(post.title?.slice(0, 256) || "Reddit Post")
    .setURL(url)
    .setColor(0x00acee)
    .setFooter({
      text: `r/${subreddit} • 👍 ${post.ups ?? 0} • 💬 ${
        post.num_comments ?? 0
      }`,
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
    .setName("reddit-random")
    .setDescription("Grab a random hot post from a subreddit.")
    .addStringOption((option) =>
      option
        .setName("subreddit")
        .setDescription("Subreddit (without r/). Default: all")
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      const subredditInput = interaction.options.getString("subreddit");
      const subreddit = (subredditInput || "all").replace(/^r\//i, "");

      await interaction.deferReply();

      const url = buildRedditUrl(subreddit);

      let json;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "AFTIES-BOT/1.0 (Discord bot)",
          },
        });

        if (!res.ok) {
          throw new Error(`Reddit responded with status ${res.status}`);
        }

        json = await res.json();
      } catch (err) {
        console.error("[reddit-random] fetch error:", err);
        return interaction.editReply({
          content: `❌ Failed to fetch posts from r/${subreddit}. The sub may not exist or Reddit is rate limiting.`,
        });
      }

      if (
        !json ||
        !json.data ||
        !Array.isArray(json.data.children) ||
        json.data.children.length === 0
      ) {
        return interaction.editReply({
          content: `⚠️ No posts found for r/${subreddit}.`,
        });
      }

      const isNsfwChannel = interaction.channel?.nsfw === true;

      const candidates = json.data.children
        .map((c) => c.data)
        .filter((p) => !p.stickied)
        .filter((p) => {
          if (p.over_18 && !isNsfwChannel) return false;
          return true;
        });

      if (!candidates.length) {
        return interaction.editReply({
          content: isNsfwChannel
            ? `⚠️ Couldn’t find any usable hot posts in r/${subreddit}.`
            : `⚠️ Only NSFW posts found in r/${subreddit}, and this channel isn’t marked NSFW.`,
        });
      }

      const post = pickRandom(candidates);
      if (!post) {
        return interaction.editReply({
          content: `⚠️ Couldn’t pick a random post from r/${subreddit}.`,
        });
      }

      const embed = buildEmbedFromPost(post, subreddit);

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[reddit-random] error:", err);
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: "❌ Error running /reddit-random.",
        });
      } else if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: "❌ Error running /reddit-random.",
          ephemeral: true,
        });
      }
    }
  },
};
