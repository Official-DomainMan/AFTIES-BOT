// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show AFTIES BOT commands and what they do"),

  async execute(interaction) {
    try {
      const guildName = interaction.guild?.name ?? "this server";

      const embed = new EmbedBuilder()
        .setTitle("📖 AFTIES BOT — Help Menu")
        .setDescription(
          "Here’s what I can do right now.\n" +
            "Use these slash commands in your server. Some require mod permissions."
        )
        .setColor(0xff66cc)
        .addFields(
          {
            name: "🎮 Games (channel mini-games)",
            value: [
              "**/counting-set** — Set the counting channel.",
              "**/counting-reset** — Reset the current count.",
              "**/counting-rules** — Show how the counting game works.",
              "**/counting-leaderboard** — Show top counters.",
              "",
              "**/lastletter-set** — Set the Last Letter game channel.",
              "**/lastletter-reset** — Reset the Last Letter chain so any word can start.",
              "**/lastletter-leaderboard** — Show top Last Letter players (points = word length).",
              "",
              "**/phone** — Start or configure the Phone Guy random call game.",
            ].join("\n"),
            inline: false,
          },
          {
            name: "🛡️ Moderation",
            value: [
              "**/warn** — Warn a user (uses mod policy & auto-timeouts).",
              "**/warn-remove** — Remove a warning from a user.",
              "**/timeout** — Timeout a member for a set duration.",
              "**/untimeout** — Remove an active timeout.",
              "**/note** — Add a private moderation note.",
              "**/infractions** — View a user’s warns & notes.",
              "**/modlog** — Configure/show the moderation log channel.",
              "**/modpolicy** — Configure auto-timeout thresholds + DM behavior.",
              "**/appeal** — Share appeal info/template for punished users.",
              "**/purge** — Bulk delete recent messages.",
            ].join("\n"),
            inline: false,
          },
          {
            name: "🎵 Music",
            value: [
              "**/play** `<query>` — Join VC and play a track or playlist.",
              "**/skip** — Skip the current track.",
              "**/stop** — Stop playback and clear the queue.",
              "**/queue** — Show the current music queue.",
              "**/leave** — Disconnect the bot from voice.",
            ].join("\n"),
            inline: false,
          },
          {
            name: "📎 Reddit",
            value:
              "**/reddit-top** `<subreddit>` — Show top posts from a subreddit as embeds.",
            inline: false,
          },
          {
            name: "⚙️ Utility",
            value: [
              "**/ping** — Check bot latency.",
              "**/help** — Show this help menu.",
              // add /botinfo here if/when you have it
            ].join("\n"),
            inline: false,
          }
        )
        .setFooter({
          text: `Serving ${guildName}`,
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: false, // change to true if you want it private
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
