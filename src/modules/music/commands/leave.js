const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("Disconnect the bot from the voice channel"),

  async execute(interaction) {
    const distube = interaction.client.distube;
    if (!distube) {
      await interaction.reply({
        content: "❌ Music system not ready.",
        ephemeral: true,
      });
      return;
    }

    const queue = distube.get(interaction.guild.id);
    if (!queue) {
      await interaction.reply({
        content: "❌ I’m not in a voice channel.",
        ephemeral: true,
      });
      return;
    }

    try {
      await distube.voices.leave(interaction.guild.id);
      await interaction.reply("👋 Left the voice channel.");
    } catch (err) {
      console.error("[music] /leave error:", err);
      await interaction.reply({
        content: "❌ Failed to leave the voice channel.",
        ephemeral: true,
      });
    }
  },
};
