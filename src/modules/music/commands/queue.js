// src/modules/music/commands/queue.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("queue")
    .setDescription("Show the current music queue"),

  async execute(interaction) {
    try {
      const distube = interaction.client.distube;
      if (!distube) {
        return interaction.reply({
          content: "❌ Music system is not initialized on this bot.",
          ephemeral: true,
        });
      }

      const queue = distube.getQueue(interaction.guildId);
      if (!queue || !queue.songs || queue.songs.length === 0) {
        return interaction.reply({
          content: "📭 Queue is empty. Use `/play` to add something.",
          ephemeral: true,
        });
      }

      const now = queue.songs[0];
      const upNext = queue.songs.slice(1, 11);

      const embed = new EmbedBuilder()
        .setTitle("🎶 Music Queue")
        .setDescription(
          `**Now Playing:** ${now.name} \`${now.formattedDuration}\`\n` +
            (upNext.length
              ? `\n**Up Next:**\n${upNext
                  .map(
                    (s, i) =>
                      `**${i + 1}.** ${s.name} \`${s.formattedDuration}\``,
                  )
                  .join("\n")}`
              : "\n**Up Next:** *(nothing)*"),
        )
        .setColor(0x5865f2);

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[music] /queue error:", err);
      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: "❌ Error showing queue.",
          ephemeral: true,
        });
      }
    }
  },
};
