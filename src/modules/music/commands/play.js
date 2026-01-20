// src/modules/music/commands/play.js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from a URL or search query.")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("YouTube URL / Spotify URL / search term")
        .setRequired(true),
    ),

  async execute(interaction) {
    const { client, guild, member, channel } = interaction;
    const query = interaction.options.getString("query", true);

    // Must be in a VC
    const voiceChannel = member.voice.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: "❌ You need to be in a voice channel first.",
        ephemeral: true,
      });
    }

    if (!voiceChannel.joinable || !voiceChannel.speakable) {
      return interaction.reply({
        content:
          "❌ I don't have permission to join and speak in that voice channel.",
        ephemeral: true,
      });
    }

    const distube = client.distube;
    if (!distube) {
      console.error("[music] client.distube is missing.");
      return interaction.reply({
        content: "❌ Music system is not initialized.",
        ephemeral: true,
      });
    }

    try {
      console.log("[music] /play invoked:", {
        guildId: guild.id,
        userId: member.id,
        query,
        voiceChannel: voiceChannel.name,
      });

      await interaction.deferReply();

      await distube.play(voiceChannel, query, {
        member,
        textChannel: channel,
      });

      await interaction.editReply(
        `🎵 Searching and playing: \`${query}\` (if I stay silent, check logs for [music] error)`,
      );
    } catch (err) {
      console.error("[music] /play error:", err);

      if (!interaction.deferred && !interaction.replied) {
        return interaction.reply({
          content: `❌ Error trying to play that: \`${err.message ?? err}\``,
          ephemeral: true,
        });
      }

      return interaction.editReply({
        content: `❌ Error trying to play that: \`${err.message ?? err}\``,
      });
    }
  },
};
