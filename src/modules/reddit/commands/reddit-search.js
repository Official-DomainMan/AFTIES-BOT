// src/modules/reddit/commands/reddit-search.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function buildSearchUrl(query, subreddit, sort) {
  const params = new URLSearchParams();
  params.set("q", query);
  params.set("limit", "50");
  params.set("type", "link");
  params.set("sort", sort || "relevance");

  if (subreddit) {
    // restrict to subreddit
    params.set("restrict_sr", "1");
    return `https://www.reddit.com/r/${encodeURIComponent(
      subreddit,
    )}/search.json?${params.toString()}`;
  }

  // global search
  return `https://www.reddit.com/search.json?${params.toString()}`;
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

function buildEmbedFromPost(post, query, subreddit) {
  const sub = post.subreddit || subreddit || "unknown";
  const url = `https://reddit.com${post.permalink}`;
  const imageUrl = getImageFromPost(post);

  const embed = new EmbedBuilder()
    .setTitle(post.title?.slice(0, 256) || "Reddit Search Result")
    .setURL(url)
    .setColor(0x00aeff)
    .setFooter({
      text: `r/${sub} • u/${post.author || "unknown"} • 👍 ${
        post.ups ?? 0
      } • 💬 ${post.num_comments ?? 0}`,
    })
    .setTimestamp(
      post.created_utc ? new Date(post.created_utc * 1000) : new Date(),
    );

  const descParts = [];
  if (query) descParts.push(`Search: \`${query}\``);
  if (subreddit) descParts.push(`Subreddit: r/${subreddit}`);

  const infoLine = descParts.length ? descParts.join(" • ") : null;

  if (post.selftext && post.selftext.trim().length > 0) {
    let body =
      post.selftext.length > 1600
        ? post.selftext.slice(0, 1600) + "…"
        : post.selftext;
    if (infoLine) body = infoLine + "\n\n" + body;
    embed.setDescription(body);
  } else if (infoLine) {
    embed.setDescription(infoLine);
  }

  if (imageUrl) {
    embed.setImage(imageUrl);
  }

  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reddit-search")
    .setDescription("Search Reddit posts by keyword.")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("Search query / keywords")
        .setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("subreddit")
        .setDescription(
          "Optional subreddit (without r/); search all if omitted",
        )
        .setRequired(false),
    )
    .addStringOption((option) =>
      option
        .setName("sort")
        .setDescription("Sort order")
        .setRequired(false)
        .addChoices(
          { name: "relevance", value: "relevance" },
          { name: "hot", value: "hot" },
          { name: "top", value: "top" },
          { name: "new", value: "new" },
          { name: "comments", value: "comments" },
        ),
    )
    .addIntegerOption((option) =>
      option
        .setName("count")
        .setDescription("How many results (1–5). Default: 3")
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

      const query = interaction.options.getString("query", true).trim();
      let subreddit = interaction.options.getString("subreddit");
      const sort = interaction.options.getString("sort") || "relevance";
      const count = interaction.options.getInteger("count") || 3;

      if (!query) {
        return interaction.reply({
          content: "❌ Please provide a non-empty search query.",
          ephemeral: true,
        });
      }

      if (subreddit) {
        subreddit = subreddit.replace(/^r\//i, "").trim();
        if (!subreddit) subreddit = null;
      }

      await interaction.deferReply();

      const url = buildSearchUrl(query, subreddit, sort);
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
        console.error("[reddit-search] fetch error:", err);
        return interaction.editReply({
          content: `❌ Failed to search Reddit for \`${query}\`${
            subreddit ? ` in r/${subreddit}` : ""
          }.`,
        });
      }

      if (
        !json ||
        !json.data ||
        !Array.isArray(json.data.children) ||
        json.data.children.length === 0
      ) {
        return interaction.editReply({
          content: `⚠️ No results found for \`${query}\`${
            subreddit ? ` in r/${subreddit}` : ""
          }.`,
        });
      }

      // No NSFW filtering; server is already wild
      const posts = json.data.children
        .map((c) => c.data)
        .filter((p) => !p.stickied);

      if (!posts.length) {
        return interaction.editReply({
          content: `⚠️ Only stickied or unusable posts found for \`${query}\`${
            subreddit ? ` in r/${subreddit}` : ""
          }.`,
        });
      }

      const slice = posts.slice(0, count);
      const embeds = slice.map((post) =>
        buildEmbedFromPost(post, query, subreddit),
      );

      await interaction.editReply({ embeds });
    } catch (err) {
      console.error("[reddit-search] error:", err);
      if (interaction.deferred && !interaction.replied) {
        await interaction.editReply({
          content: "❌ Error running /reddit-search.",
        });
      } else if (!interaction.deferred && !interaction.replied) {
        await interaction.reply({
          content: "❌ Error running /reddit-search.",
          ephemeral: true,
        });
      }
    }
  },
};
