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
      const query = normalizeQuery(raw);

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

      // Try to play. DisTube will join channel + queue.
      await distube.play(voice, query, {
        member,
        textChannel: interaction.channel,
        interaction,
      });

      const embed = new EmbedBuilder()
        .setTitle("🎶 Added to queue")
        .setDescription(`**Query:** ${query}`)
        .setColor(0x2ecc71);

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error("[music] /play error:", err);

      const code = err?.errorCode || err?.code;

      if (code === "NO_RESULT") {
        // Give the user actionable next steps
        const embed = new EmbedBuilder()
          .setTitle("❌ No results found")
          .setDescription(
            `I couldn't find anything for that search.\n\n` +
              `**Try one of these:**\n` +
              `• Use a direct **YouTube link**\n` +
              `• Use a simpler search: \`i dont know slum village\`\n` +
              `• Add artist/title: \`Slum Village - I Don't Know\`\n\n` +
              `If **links work** but **search doesn't**, your Railway build is missing a working search provider/plugin (we can fix that next).`,
          )
          .setColor(0xe74c3c);

        // If we deferred, we must editReply; otherwise reply
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply({ embeds: [embed] });
        }
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const msg =
        err?.message?.slice(0, 1800) ||
        "Unknown error while trying to play that.";

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          content: `❌ Error trying to play that:\n\`\`\`\n${msg}\n\`\`\``,
        });
      }

      return interaction.reply({
        content: `❌ Error trying to play that:\n\`\`\`\n${msg}\n\`\`\``,
        ephemeral: true,
      });
    }
  },
};
