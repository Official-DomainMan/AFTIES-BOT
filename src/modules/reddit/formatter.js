const { EmbedBuilder } = require("discord.js");

function isImageUrl(url) {
  return typeof url === "string" && /\.(png|jpe?g|gif|webp)$/i.test(url);
}

function postToEmbed(post) {
  const permalink = `https://reddit.com${post.permalink}`;
  const url = post.url_overridden_by_dest || post.url;

  const embed = new EmbedBuilder()
    .setTitle((post.title || "Reddit Post").slice(0, 256))
    .setURL(permalink)
    .setDescription(
      `👍 ${post.ups}   💬 ${post.num_comments}   •   r/${post.subreddit}`
    )
    .setFooter({ text: `u/${post.author}` });

  if (post.over_18) {
    embed.setDescription(`🔞 NSFW • ` + embed.data.description);
  }

  if (isImageUrl(url)) {
    embed.setImage(url);
  } else if (post.thumbnail && post.thumbnail.startsWith("http")) {
    embed.setDescription(post.thumbnail);
  }

  if (url && !isImageUrl(url)) {
    embed.addFields({
      name: "Link",
      value: url.length > 1024 ? permalink : url,
    });
  }

  return embed;
}

module.exports = { postToEmbed };
