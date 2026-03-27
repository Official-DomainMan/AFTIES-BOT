// src/modules/music/commands/play.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function normalizeQuery(input) {
  if (!input) return "";
  return input
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

function isUrl(str) {
  try {
    // eslint-disable-next-line no-new
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function truncate(str, max = 1800) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 3) + "..." : str;
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
    // Never let this command time out
    let deferred = false;

    try {
      const distube = interaction.client.distube;
      if (!distube) {
        return interaction.reply({
          content: "❌ Music system is not initialized on this bot.",
          ephemeral: true,
        });
      }

      const raw = interaction.options.getString("query", true);
      const query = normalizeQuery(raw);

      // Must be in voice
      const member = interaction.member;
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({
          content: "🔊 Join a voice channel first, then use `/play`.",
          ephemeral: true,
        });
      }

      // Defer so we don't hit the 3s interaction window on slow searches
      await interaction.deferReply();
      deferred = true;

      // Try to play. DisTube will join + queue.
      await distube.play(voiceChannel, query, {
        member,
        textChannel: interaction.channel,
        interaction,
      });

      const embed = new EmbedBuilder()
        .setTitle("🎶 Added to queue")
        .setDescription(
          isUrl(query) ? `**Link:** ${query}` : `**Search:** \`${query}\``,
        )
        .setColor(0x2ecc71)
        .setFooter({
          text: `Serving ${interaction.guild?.name || "this server"}`,
        })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[music] /play error:", err);

      const code = err?.errorCode || err?.code;
      const msg = truncate(err?.message || "Unknown error.");

      // DisTube-specific: No results
      if (code === "NO_RESULT") {
        const embed = new EmbedBuilder()
          .setTitle("❌ No results found")
          .setDescription(
            `I couldn’t find anything for that.\n\n` +
              `**Try:**\n` +
              `• A direct **YouTube link**\n` +
              `• Add artist + title: \`Slum Village - I Don't Know\`\n` +
              `• Keep it simple: \`i don't know\`\n\n` +
              `If **links work** but **search doesn’t**, it’s usually extraction/provider limitations in the hosting environment.`,
          )
          .setColor(0xe74c3c)
          .setFooter({
            text: `Serving ${interaction.guild?.name || "this server"}`,
          });

        if (deferred || interaction.deferred || interaction.replied) {
          return interaction.editReply({ embeds: [embed] });
        }
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Common “ffmpeg missing”
      if (msg.toLowerCase().includes("ffmpeg is not installed")) {
        const embed = new EmbedBuilder()
          .setTitle("❌ ffmpeg missing")
          .setDescription(
            `This host is missing **ffmpeg**, which is required for audio playback.\n\n` +
              `✅ Fix: ensure your Railway Docker image installs ffmpeg.\n` +
              `If you already added it, make sure Railway rebuilt from the updated Dockerfile.`,
          )
          .setColor(0xe67e22);

        if (deferred || interaction.deferred || interaction.replied) {
          return interaction.editReply({ embeds: [embed] });
        }
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Spotify / DRM style failures (yt-dlp / extractor)
      const lower = msg.toLowerCase();
      if (
        lower.includes("[drm]") ||
        lower.includes("drm protection") ||
        lower.includes("not supported") ||
        lower.includes("requested site is known to use drm")
      ) {
        const embed = new EmbedBuilder()
          .setTitle("🚫 Can’t play that source (DRM)")
          .setDescription(
            `That link/source is **DRM-protected** (common with Spotify and some providers).\n\n` +
              `✅ Use:\n` +
              `• YouTube links\n` +
              `• YouTube search queries (artist + title)\n\n` +
              `If you want Spotify support, the usual approach is **Spotify for metadata → play via YouTube search**, not direct playback.`,
          )
          .setColor(0xe74c3c);

        if (deferred || interaction.deferred || interaction.replied) {
          return interaction.editReply({ embeds: [embed] });
        }
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Python version issue (yt-dlp runner)
      if (
        lower.includes("unsupported version of python") ||
        lower.includes("only python versions 3.10 and above")
      ) {
        const embed = new EmbedBuilder()
          .setTitle("🐍 Python version too old on host")
          .setDescription(
            `yt-dlp requires **Python 3.10+** in this environment.\n\n` +
              `✅ Fix: update your Docker image to install Python 3.10+ (or use a base image that includes it).`,
          )
          .setColor(0xe67e22);

        if (deferred || interaction.deferred || interaction.replied) {
          return interaction.editReply({ embeds: [embed] });
        }
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Fallback generic error
      const content = `❌ Error trying to play that:\n\`\`\`\n${msg}\n\`\`\``;

      if (deferred || interaction.deferred || interaction.replied) {
        return interaction.editReply({ content });
      }

      return interaction.reply({ content, ephemeral: true });
    }
  },
};
