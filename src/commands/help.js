// src/commands/help.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show AFTIES BOT commands and what they do."),

  async execute(interaction) {
    try {
      const coreCommands = [
        "• **/botinfo** — Show info about AFTIES and where it's running",
        "• **/help** — Show AFTIES BOT commands and what they do",
        "• **/ping** — Check bot latency",
      ].join("\n");

      const casinoCommands = [
        "• **/blackjack** — Play interactive blackjack with the casino balance.",
        "• **/slots** — Spin the slots.",
        "• **/roulette** — Bet on red, black, or green.",
        "• **/casino** — Open the AFTIES Casino lobby.",
      ].join("\n");

      const economyCommands = [
        "• **/balance** — Check your casino balance.",
        "• **/daily** — Claim your daily casino allowance.",
        "• **/pay** — Gift casino balance to another user.",
        "• **/transaction-log** — View your recent casino transactions.",
        "• **/work** — Clock in, do a risky job, maybe get paid.",
      ].join("\n");

      const levelingCommands = [
        "• **/level** — Show your current level and XP.",
        "• **/rank** — Show your level & XP, or someone else's.",
        "• **/profile** — Show your leveling stats (or someone else's).",
        "• **/levels** — Show the top leveled users in this server.",
        "• **/levelroles** — Configure automatic level-up role rewards.",
        "• **/levelup-channel** — Set or clear the channel for level-up announcements.",
        "• **/levelreset** — Reset all leveling data for this server.",
      ].join("\n");

      const funCommands = [
        "• **/slutball** — Ask the Slutball a question and get a filthy answer.",
      ].join("\n");

      const embed = new EmbedBuilder()
        .setTitle("📖 AFTIES BOT — Help")
        .setDescription(
          "Here's what I can do for you in this server. Use the categories below to find what you need.",
        )
        .addFields(
          {
            name: "⚙️ Core & Utility",
            value: coreCommands,
          },
          {
            name: "🎰 Casino Games",
            value: casinoCommands,
          },
          {
            name: "💸 Economy",
            value: economyCommands,
          },
          {
            name: "📈 Leveling",
            value: levelingCommands,
          },
          {
            name: "🍑 Fun",
            value: funCommands,
          },
        )
        .setFooter({
          text: "Gamble responsibly, menace irresponsibly.",
        })
        .setTimestamp();

      await interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
    } catch (err) {
      console.error("/help error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ There was an error showing the help menu.",
          ephemeral: true,
        });
      }
    }
  },
};
