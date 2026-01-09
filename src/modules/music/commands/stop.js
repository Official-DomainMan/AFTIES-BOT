const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stop")
    .setDescription("Stop music and clear the queue"),

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
        content: "❌ There is no active queue.",
        ephemeral: true,
      });
      return;
    }

    try {
      await distube.stop(interaction.guild.id);
      await interaction.reply("⏹️ Stopped playback and cleared the queue.");
    } catch (err) {
      console.error("[music] /stop error:", err);
      await interaction.reply({
        content: "❌ Failed to stop.",
        ephemeral: true,
      });
    }
  },
};
