// src/commands/botinfo.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

function formatDuration(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("Show info about AFTIES and where it's running"),

  async execute(interaction) {
    const client = interaction.client;
    const hostEnv = process.env.HOST_ENV || "UNKNOWN";

    const uptime = formatDuration(client.uptime ?? 0);
    const guildCount = client.guilds.cache.size;
    const user = client.user;

    const embed = new EmbedBuilder()
      .setTitle("🤖 AFTIES Bot Info")
      .setDescription(
        `Hey <@${interaction.user.id}>, here's what I'm working with right now.`
      )
      .addFields(
        {
          name: "Tag",
          value: user ? `${user.username}#${user.discriminator}` : "Unknown",
          inline: true,
        },
        {
          name: "ID",
          value: user ? user.id : "Unknown",
          inline: true,
        },
        {
          name: "Uptime",
          value: uptime,
          inline: true,
        },
        {
          name: "Servers",
          value: `${guildCount}`,
          inline: true,
        },
        {
          name: "Host",
          value: hostEnv,
          inline: true,
        }
      )
      .setTimestamp(new Date())
      .setColor(0xff66cc);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
