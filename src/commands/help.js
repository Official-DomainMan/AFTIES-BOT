// src/commands/help.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show AFTIES BOT commands and what they do."),

  async execute(interaction) {
    try {
      const user = interaction.user;

      // --- Page content (staying true to your original text) ---

      const pageDescriptions = [
        // PAGE 1: Core & Casino
        {
          title: "📖 AFTIES BOT — Help (1/3)",
          description: [
            `Welcome, ${user}. Here’s what I can do in this server.`,
            "",
            "**⚙️ Core & Utility**",
            "• **/botinfo** — Show info about AFTIES and where it's running",
            "• **/help** — Show AFTIES BOT commands and what they do",
            "• **/ping** — Check bot latency",
            "",
            "**🎰 Casino Games**",
            "• **/blackjack** — Play interactive blackjack with the casino balance.",
            "• **/casino** — Open the AFTIES Casino lobby.",
            "• **/roulette** — Bet on red, black, or green.",
            "• **/slots** — Spin the slots.",
          ].join("\n"),
        },

        // PAGE 2: Economy
        {
          title: "📖 AFTIES BOT — Help (2/3)",
          description: [
            "**💸 Economy**",
            "• **/balance** — Check your casino balance.",
            "• **/daily** — Claim your daily casino allowance.",
            "• **/pay** — Gift casino balance to another user.",
            "• **/transaction-log** — View your recent casino transactions.",
            "• **/work** — Clock in, do a risky job, maybe get paid.",
          ].join("\n"),
        },

        // PAGE 3: Leveling + Fun
        {
          title: "📖 AFTIES BOT — Help (3/3)",
          description: [
            "**📈 Leveling**",
            "• **/level** — Show your current level and XP.",
            "• **/rank** — Show your level & XP, or someone else's.",
            "• **/profile** — Show your leveling stats (or someone else's).",
            "• **/levels** — Show the top leveled users in this server.",
            "• **/levelroles** — Configure automatic level-up role rewards.",
            "• **/levelup-channel** — Set or clear the channel for level-up announcements.",
            "• **/levelreset** — Reset all leveling data for this server.",
            "",
            "**🍑 Fun**",
            "• **/slutball** — Ask the Slutball a question and get a filthy answer.",
            "",
            "_For Reddit commands, use **/reddit-help** to see the full Reddit menu._",
          ].join("\n"),
        },
      ];

      const pages = pageDescriptions.map((p) =>
        new EmbedBuilder()
          .setTitle(p.title)
          .setDescription(p.description)
          .setFooter({
            text: "Gamble responsibly, menace irresponsibly.",
          })
          .setTimestamp(),
      );

      let currentPage = 0;

      const getRow = () =>
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("help_prev")
            .setLabel("◀️ Previous")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
          new ButtonBuilder()
            .setCustomId("help_next")
            .setLabel("Next ▶️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === pages.length - 1),
        );

      // Send the initial, PUBLIC help message (not ephemeral)
      const message = await interaction.reply({
        embeds: [pages[currentPage]],
        components: [getRow()],
        fetchReply: true,
      });

      const filter = (i) =>
        i.user.id === user.id &&
        i.customId.startsWith("help_") &&
        i.message.id === message.id;

      const collector = message.createMessageComponentCollector({
        filter,
        time: 60_000, // 60 seconds of paging
      });

      collector.on("collect", async (i) => {
        try {
          if (i.customId === "help_prev" && currentPage > 0) {
            currentPage -= 1;
          } else if (
            i.customId === "help_next" &&
            currentPage < pages.length - 1
          ) {
            currentPage += 1;
          }

          await i.update({
            embeds: [pages[currentPage]],
            components: [getRow()],
          });
        } catch (err) {
          console.error("[/help pagination] error:", err);
        }
      });

      collector.on("end", async () => {
        try {
          await message.edit({ components: [] }).catch(() => {});
        } catch {
          // ignore
        }
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
