// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

/**
 * Simple categorization based on command name.
 * You can tweak these mappings anytime without touching the core logic.
 */
function getCategory(commandName) {
  // Games
  if (
    commandName.startsWith("counting") ||
    commandName.startsWith("lastletter") ||
    commandName === "phone"
  ) {
    return "🎮 Games";
  }

  // Moderation
  if (
    [
      "warn",
      "warn-remove",
      "timeout",
      "untimeout",
      "note",
      "infractions",
      "modlog",
      "modpolicy",
      "appeal",
      "purge",
    ].includes(commandName)
  ) {
    return "🛡️ Moderation";
  }

  // Music
  if (["play", "skip", "stop", "leave", "queue"].includes(commandName)) {
    return "🎵 Music";
  }

  // Reddit / social
  if (commandName.startsWith("reddit")) {
    return "📎 Reddit & Social";
  }

  // Default bucket
  return "⚙️ Utility";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show AFTIES BOT commands and what they do"),

  async execute(interaction) {
    try {
      const guildName = interaction.guild?.name ?? "this server";

      // Grab all registered commands from the client
      const allCommands = Array.from(interaction.client.commands.values());

      if (!allCommands.length) {
        return interaction.reply({
          content: "❌ I don't see any commands registered right now.",
          ephemeral: true,
        });
      }

      // Group commands by category
      const groups = new Map(); // category -> [ " /name — desc" ]
      for (const cmd of allCommands) {
        const name = cmd?.data?.name;
        const description = cmd?.data?.description ?? "No description set.";

        if (!name) continue;

        const category = getCategory(name);
        if (!groups.has(category)) groups.set(category, []);

        groups.get(category).push(`• **/${name}** — ${description}`);
      }

      // Sort categories for a consistent order
      const orderedCategories = [
        "🎮 Games",
        "🛡️ Moderation",
        "🎵 Music",
        "📎 Reddit & Social",
        "⚙️ Utility",
      ];

      const fields = [];

      for (const category of orderedCategories) {
        const items = groups.get(category);
        if (!items || items.length === 0) continue;

        fields.push({
          name: category,
          value: items.join("\n"),
          inline: false,
        });
      }

      // If some category slipped outside our known list, append them at the end
      for (const [category, items] of groups.entries()) {
        if (!orderedCategories.includes(category)) {
          fields.push({
            name: category,
            value: items.join("\n"),
            inline: false,
          });
        }
      }

      const embed = new EmbedBuilder()
        .setTitle("📖 AFTIES BOT — Help Menu")
        .setDescription(
          "Here’s everything I currently know how to do.\n" +
            "This list **auto-updates** whenever new slash commands are added."
        )
        .setColor(0xff66cc)
        .addFields(fields)
        .setFooter({ text: `Serving ${guildName}` })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: false, // set to true if you ever want it private
      });
    } catch (err) {
      console.error("/help error:", err);
      try {
        if (!interaction.deferred && !interaction.replied) {
          await interaction.reply({
            content: "❌ Error running /help.",
            ephemeral: true,
          });
        }
      } catch (e) {
        console.error("Failed to send /help error response:", e);
      }
    }
  },
};
