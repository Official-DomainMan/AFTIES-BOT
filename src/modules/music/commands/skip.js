const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("skip")
    .setDescription("Skip the current song"),

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
      await distube.skip(interaction.guild.id);
      await interaction.reply("⏭️ Skipped the current song.");
    } catch (err) {
      console.error("[music] /skip error:", err);
      await interaction.reply({
        content: "❌ Nothing to skip or error skipping.",
        ephemeral: true,
      });
    }
  },
};
