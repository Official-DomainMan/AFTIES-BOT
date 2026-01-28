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
      const client = interaction.client;
      const guild = interaction.guild;
      const user = interaction.user;

      // Pull all slash commands from the client's command collection
      const commands = Array.from(client.commands?.values?.() || []).filter(
        (cmd) => cmd.data && typeof cmd.data.name === "string",
      );

      if (!commands.length) {
        return interaction.reply({
          content: "❌ I don't have any commands registered right now.",
          ephemeral: true,
        });
      }

      // Sort commands alphabetically
      commands.sort((a, b) =>
        a.data.name.localeCompare(b.data.name, undefined, {
          sensitivity: "base",
        }),
      );

      // Map to display lines like: • **/ping** — Check bot latency
      const lines = commands.map((cmd) => {
        const name = cmd.data.name;
        const desc =
          cmd.data.description && cmd.data.description.length
            ? cmd.data.description
            : "No description provided.";
        return `• **/${name}** — ${desc}`;
      });

      // Paginate lines into chunks to stay far under embed limits
      const pageSize = 10; // commands per page
      const pages = [];
      for (let i = 0; i < lines.length; i += pageSize) {
        const chunk = lines.slice(i, i + pageSize);
        const pageIndex = pages.length;
        const totalPages = Math.ceil(lines.length / pageSize) || 1;

        const embed = new EmbedBuilder()
          .setTitle(`📖 AFTIES BOT — Help (${pageIndex + 1}/${totalPages})`)
          .setDescription(
            [
              `Hello, ${user}. Here are the available commands:`,
              "",
              chunk.join("\n"),
            ].join("\n"),
          )
          .setFooter({
            text: `Serving ${guild ? guild.name : "this server"}`,
          })
          .setTimestamp();

        pages.push(embed);
      }

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

      // Public help message (not ephemeral)
      const message = await interaction.reply({
        embeds: [pages[currentPage]],
        components: pages.length > 1 ? [getRow()] : [],
        fetchReply: true,
      });

      if (pages.length === 1) return; // no need for pagination

      const filter = (i) =>
        i.user.id === user.id &&
        i.customId.startsWith("help_") &&
        i.message.id === message.id;

      const collector = message.createMessageComponentCollector({
        filter,
        time: 60_000, // 60 seconds of interaction window
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
