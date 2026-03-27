// src/modules/music/commands/stop.js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop music and clear the queue"),

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
          content: "🔊 Join a voice channel first, then use `/stop`.",
          ephemeral: true,
        });
      }

      const queue = distube.getQueue(interaction.guildId);
      if (!queue || !queue.songs || queue.songs.length === 0) {
        return interaction.reply({
          content: "📭 There’s nothing playing right now.",
          ephemeral: true,
        });
      }

      // Optional: ensure user is in same VC as bot
      const botVoice = interaction.guild.members.me?.voice?.channel;
      if (botVoice && botVoice.id !== voice.id) {
        return interaction.reply({
          content: "❌ You need to be in my voice channel to stop the music.",
          ephemeral: true,
        });
      }

      await distube.stop(interaction.guildId);

      return interaction.reply({
        content: "⏹️ Stopped playback and cleared the queue.",
      });
    } catch (err) {
      console.error("[music] /stop error:", err);

      const msg = err?.message || "Unknown error";

      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: `❌ Couldn't stop playback.\n\`\`\`\n${String(msg).slice(
            0,
            1500,
          )}\n\`\`\``,
          ephemeral: true,
        });
      }
    }
  },
};
