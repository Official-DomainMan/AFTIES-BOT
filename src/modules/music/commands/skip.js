// src/modules/music/commands/skip.js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),

  async execute(interaction) {
    try {
      const distube = interaction.client.distube;
      if (!distube) {
        return interaction.reply({
          content: "❌ Music system is not initialized on this bot.",
          ephemeral: true,
        });
      }

      const member = interaction.member;
      const voice = member?.voice?.channel;
      if (!voice) {
        return interaction.reply({
          content: "🔊 Join a voice channel first, then use `/skip`.",
          ephemeral: true,
        });
      }

      const queue = distube.getQueue(interaction.guildId);
      if (!queue || !queue.songs || queue.songs.length === 0) {
        return interaction.reply({
          content: "📭 There’s nothing in the queue to skip.",
          ephemeral: true,
        });
      }

      // Optional: ensure user is in same VC as bot
      const botVoice = interaction.guild.members.me?.voice?.channel;
      if (botVoice && botVoice.id !== voice.id) {
        return interaction.reply({
          content: "❌ You need to be in my voice channel to skip songs.",
          ephemeral: true,
        });
      }

      await distube.skip(interaction.guildId);

      return interaction.reply({
        content: "⏭️ Skipped the current song.",
      });
    } catch (err) {
      console.error("[music] /skip error:", err);

      const msg = err?.message || "Unknown error";

      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: `❌ Couldn't skip the song.\n\`\`\`\n${String(msg).slice(
            0,
            1500,
          )}\n\`\`\``,
          ephemeral: true,
        });
      }
    }
  },
};
