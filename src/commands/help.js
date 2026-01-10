// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show available commands and what they do"),

  async execute(interaction) {
    const commands = interaction.client.commands;

    if (!commands || commands.size === 0) {
      return interaction.reply({
        content: "❌ No commands are loaded on this bot.",
        ephemeral: true,
      });
    }

    // Build a list like: `/ping` — Check bot latency
    const lines = [];
    for (const cmd of commands.values()) {
      const name = cmd?.data?.name ?? "unknown";
      const desc = cmd?.data?.description ?? "No description";
      // Skip internal / dev-only if needed in future
      lines.push(`</${name}:${interaction.commandId}> — ${desc}`);
    }

    const embed = new EmbedBuilder()
      .setTitle("📖 AFTIES Help")
      .setDescription(
        "Here are the currently available slash commands:\n\n" +
          lines.join("\n")
      )
      .setFooter({
        text: "Tip: Use /help again after new features are added.",
      })
      .setColor(0xff66cc);

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
