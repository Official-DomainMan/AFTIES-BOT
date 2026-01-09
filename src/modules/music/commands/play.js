const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play music from a URL or search term")
    .addStringOption((o) =>
      o
        .setName("query")
        .setDescription(
          "URL or search term (Spotify, YouTube, Soundcloud, etc.)"
        )
        .setRequired(true)
    ),

  async execute(interaction) {
    const query = interaction.options.getString("query", true);

    const member = interaction.member;
    const voiceChannel = member.voice?.channel;
    if (!voiceChannel) {
      await interaction.reply({
        content: "❌ You must be in a voice channel to use `/play`.",
        ephemeral: true,
      });
      return;
    }

    const client = interaction.client;
    const distube = client.distube;
    if (!distube) {
      await interaction.reply({
        content: "❌ Music system is not initialized.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    try {
      await distube.play(voiceChannel, query, {
        textChannel: interaction.channel,
        member,
      });

      await interaction.editReply(`🎵 Searching / queuing: \`${query}\``);
    } catch (err) {
      console.error("[music] /play error:", err);
      await interaction.editReply("❌ Failed to play that track.");
    }
  },
};
