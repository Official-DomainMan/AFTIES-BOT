const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current music queue"),

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
    if (!queue || !queue.songs.length) {
      await interaction.reply({
        content: "📭 The queue is empty.",
        ephemeral: true,
      });
      return;
    }

    const lines = queue.songs.slice(0, 10).map((s, i) => {
      const prefix = i === 0 ? "▶️ Now" : `#${i}`;
      return `${prefix} • **${s.name}** \`[${s.formattedDuration}]\` • requested by <@${s.user?.id}>`;
    });

    await interaction.reply(lines.join("\n"));
  },
};
