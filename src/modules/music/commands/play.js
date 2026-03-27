// src/modules/music/commands/play.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function normalizeQuery(input) {
  if (!input) return "";
  return (
    input
      // smart quotes/apostrophes -> plain
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"')
      // long dashes -> hyphen
      .replace(/[–—]/g, "-")
      // non-breaking space -> normal
      .replace(/\u00A0/g, " ")
      // strip weird invisible chars
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .trim()
  );
}

function isSpotifyUrl(q) {
  if (!q) return false;
  return (
    q.includes("open.spotify.com/") ||
    q.startsWith("spotify:") ||
    q.includes("spotify.link/")
  );
}

/**
 * Spotify → YouTube search fallback.
 * Uses Spotify oEmbed endpoint (no auth required) to get a human title.
 * Example oEmbed title: "I Don't Know - Slum Village"
 */
async function spotifyToSearchQuery(spotifyUrl) {
  // Spotify "share links" sometimes are spotify.link short URLs.
  // We can try oEmbed directly with whatever URL we have.
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(
    spotifyUrl,
  )}`;

  const res = await fetch(oembedUrl, {
    headers: {
      // This helps avoid some edge cases where services dislike blank UA
      "User-Agent": "AFTIES-BOT/1.0 (Discord bot)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Spotify oEmbed responded with status ${res.status}`);
  }

  const data = await res.json();
  const title = (data?.title || "").trim();

  if (!title) {
    throw new Error("Spotify oEmbed returned no title.");
  }

  // Turn Spotify title into a strong YouTube search query
  // Add "audio" to bias toward playable uploads
  return `${title} audio`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from a URL or search query.")
    .addStringOption((opt) =>
      opt
        .setName("query")
        .setDescription("YouTube URL / Spotify URL / search term")
        .setRequired(true),
    ),

  async execute(interaction) {
    try {
      const distube = interaction.client.distube;
      if (!distube) {
        return interaction.reply({
          content: "❌ Music system is not initialized on this bot.",
          ephemeral: true,
        });
      }

      const raw = interaction.options.getString("query", true);
      let query = normalizeQuery(raw);

      // Must be in voice
      const member = interaction.member;
      const voice = member?.voice?.channel;
      if (!voice) {
        return interaction.reply({
          content: "🔊 Join a voice channel first, then use `/play`.",
          ephemeral: true,
        });
      }

      // Defer so we don't time out on slow searches
      await interaction.deferReply();

      // Spotify fallback: convert Spotify link → YouTube search
      let wasSpotify = false;
      if (isSpotifyUrl(query)) {
        wasSpotify = true;
        try {
          const converted = await spotifyToSearchQuery(query);
          query = normalizeQuery(converted);
        } catch (e) {
          // If Spotify conversion fails, keep original query and let DisTube try
          console.warn(
            "[music] Spotify conversion failed, using original:",
            e?.message,
          );
        }
      }

      await distube.play(voice, query, {
        member,
        textChannel: interaction.channel,
        interaction,
      });

      const embed = new EmbedBuilder()
        .setTitle("🎶 Added to queue")
        .setDescription(
          `${wasSpotify ? "✅ Spotify link detected → searching YouTube\n" : ""}` +
            `**Query:** ${query}`,
        )
        .setColor(0x2ecc71);

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[music] /play error:", err);

      const code = err?.errorCode || err?.code;
      const msg = err?.message || "Unknown error";

      // Known DisTube cases
      if (code === "NO_RESULT") {
        const embed = new EmbedBuilder()
          .setTitle("❌ No results found")
          .setDescription(
            `I couldn't find anything for that.\n\n` +
              `**Try:**\n` +
              `• A direct **YouTube link**\n` +
              `• Add artist/title: \`Slum Village - I Don't Know\`\n` +
              `• Simpler search words (no fancy punctuation)\n`,
          )
          .setColor(0xe74c3c);

        return interaction.editReply({ embeds: [embed] });
      }

      // DRM warnings from yt-dlp
      if (
        msg.toLowerCase().includes("[drm]") ||
        msg.toLowerCase().includes("drm")
      ) {
        const embed = new EmbedBuilder()
          .setTitle("🚫 That source is DRM protected")
          .setDescription(
            `yt-dlp refuses to extract audio from that link/source.\n\n` +
              `**Fix:** Use a **YouTube link** or a **plain search** instead.`,
          )
          .setColor(0xe67e22);

        return interaction.editReply({ embeds: [embed] });
      }

      // Python version / yt-dlp dependency issues
      if (msg.toLowerCase().includes("unsupported version of python")) {
        const embed = new EmbedBuilder()
          .setTitle("🐍 Python version issue in Railway")
          .setDescription(
            `yt-dlp requires **Python 3.10+** in the container.\n` +
              `Your Railway build is missing it.\n\n` +
              `**Fix:** Update Dockerfile to install Python 3.11 (we’re doing that now).`,
          )
          .setColor(0xf1c40f);

        return interaction.editReply({ embeds: [embed] });
      }

      const clipped = String(msg).slice(0, 1800);

      return interaction.editReply({
        content: `❌ Error trying to play that:\n\`\`\`\n${clipped}\n\`\`\``,
      });
    }
  },
};
