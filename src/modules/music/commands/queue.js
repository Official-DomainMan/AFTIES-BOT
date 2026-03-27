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
          content: "📭 The queue is empty.",
          ephemeral: true,
        });
      }

      const nowPlaying = queue.songs[0];
      const upcoming = queue.songs.slice(1, 11);

      const embed = new EmbedBuilder()
        .setTitle("🎶 Music Queue")
        .setColor(0x5865f2)
        .addFields(
          {
            name: "Now Playing",
            value: `**${nowPlaying.name}** \`${nowPlaying.formattedDuration}\``,
            inline: false,
          },
          {
            name: "Up Next",
            value:
              upcoming.length > 0
                ? upcoming
                    .map(
                      (song, i) =>
                        `**${i + 1}.** ${song.name} \`${song.formattedDuration}\``,
                    )
                    .join("\n")
                : "_Nothing else queued._",
            inline: false,
          },
        )
        .setFooter({
          text: `Serving ${interaction.guild?.name || "this server"}`,
        })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      console.error("[music] /queue error:", err);

      if (!interaction.replied && !interaction.deferred) {
        return interaction.reply({
          content: "❌ Error showing the queue.",
          ephemeral: true,
        });
      }
    }
  },
};
