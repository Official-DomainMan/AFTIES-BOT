// src/modules/reddit/commands/reddit-user.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function buildUserUrl(username) {
  return `https://www.reddit.com/user/${encodeURIComponent(
    username,
  )}/submitted.json?limit=50`;
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
    .setTitle(post.title?.slice(0, 256) || "Reddit Post")
    .setURL(url)
    .setColor(0xff4500)
    .setFooter({
      text: `u/${post.author || "unknown"} • r/${subreddit} • 👍 ${
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
    .setName("reddit-user")
    .setDescription("Show recent posts from a Reddit user.")
    .addStringOption((option) =>
      option
        .setName("username")
        .setDescription("Reddit username (without u/)")
        .setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription("How many posts (1–5). Default: 3")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(5),
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      const rawUsername = interaction.options.getString("username", true);
      const count = interaction.options.getInteger("count") || 3;

      // Strip optional "u/" prefix
      const username = rawUsername.replace(/^u\//i, "").trim();

      if (!username) {
        return interaction.reply({
          content: "❌ Please provide a valid Reddit username.",
          ephemeral: true,
        });
      }

      await interaction.deferReply();

      const url = buildUserUrl(username);
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
        console.error("[reddit-user] fetch error:", err);
        return interaction.editReply({
          content: `❌ Failed to fetch posts for u/${username}. They might be shadowbanned, private, or Reddit is being funky.`,
        });
      }

      if (
        !json ||
        !json.data ||
        !Array.isArray(json.data.children) ||
        json.data.children.length === 0
      ) {
        return interaction.editReply({
          content: `⚠️ No recent posts found for u/${username}.`,
        });
      }

      // No NSFW filter – your whole server is chaos anyway
      const posts = json.data.children
        .map((c) => c.data)
        .filter((p) => !p.stickied);

      if (!posts.length) {
        return interaction.editReply({
          content: `⚠️ Only stickied or unusable posts found for u/${username}.`,
        });
      }

      const slice = posts.slice(0, count);
      const embeds = slice.map((post) => buildEmbedFromPost(post));

      await interaction.editReply({ embeds });
    } catch (err) {
      console.error("[reddit-user] error:", err);
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: "❌ Error running /reddit-user.",
        });
      } else if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: "❌ Error running /reddit-user.",
          ephemeral: true,
        });
      }
    }
  },
};
