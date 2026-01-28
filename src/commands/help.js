// src/commands/help.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

function categorizeCommandName(name) {
  // Normalize name for comparisons
  const n = name.toLowerCase();

  // Core / utility
  if (["help", "botinfo", "ping"].includes(n)) return "core";

  // Casino & economy
  if (
    [
      "casino",
      "blackjack",
      "roulette",
      "slots",
      "balance",
      "daily",
      "pay",
      "transaction-log",
      "work",
    ].includes(n)
  ) {
    return "casino";
  }

  // Leveling & profile
  if (
    [
      "level",
      "levelreset",
      "levelroles",
      "levels",
      "levelup-channel",
      "profile",
      "rank",
    ].includes(n)
  ) {
    return "leveling";
  }

  // Games & party (counting, last letter, slutball, etc.)
  if (
    n.startsWith("counting") ||
    n.startsWith("lastletter") ||
    ["slutball"].includes(n)
  ) {
    return "games";
  }

  // Music
  if (
    [
      "play",
      "skip",
      "stop",
      "queue",
      "pause",
      "resume",
      "nowplaying",
      "np",
    ].includes(n)
  ) {
    return "music";
  }

  // Reddit & social
  if (n.startsWith("reddit-") || n === "reddit" || n === "reddithelp") {
    return "reddit";
  }

  // Fallback
  return "other";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show AFTIES BOT commands and what they do."),

  async execute(interaction) {
    try {
      const client = interaction.client;
      const guild = interaction.guild;
      const user = interaction.user;

      const allCommands = Array.from(client.commands?.values?.() || []).filter(
        (cmd) => cmd.data && typeof cmd.data.name === "string",
      );

      if (!allCommands.length) {
        return interaction.reply({
          content: "❌ I don't have any commands registered right now.",
          ephemeral: true,
        });
      }

      // Sort alphabetically
      allCommands.sort((a, b) =>
        a.data.name.localeCompare(b.data.name, undefined, {
          sensitivity: "base",
        }),
      );

      // Bucket commands into categories
      const buckets = {
        core: [],
        casino: [],
        leveling: [],
        games: [],
        music: [],
        reddit: [],
        other: [],
      };

      for (const cmd of allCommands) {
        const name = cmd.data.name;
        const desc =
          cmd.data.description && cmd.data.description.length
            ? cmd.data.description
            : "No description provided.";

        const line = `• **/${name}** — ${desc}`;
        const cat = categorizeCommandName(name);
        if (!buckets[cat]) buckets[cat] = [];
        buckets[cat].push(line);
      }

      // Define category display order & titles
      const sections = [];

      if (buckets.core.length) {
        sections.push({
          key: "core",
          title: "🎛️ Core & Utility",
          lines: buckets.core,
        });
      }
      if (buckets.casino.length) {
        sections.push({
          key: "casino",
          title: "🎰 Casino & Economy",
          lines: buckets.casino,
        });
      }
      if (buckets.leveling.length) {
        sections.push({
          key: "leveling",
          title: "📈 Leveling & Profile",
          lines: buckets.leveling,
        });
      }
      if (buckets.games.length) {
        sections.push({
          key: "games",
          title: "🎮 Games & Party",
          lines: buckets.games,
        });
      }
      if (buckets.music.length) {
        sections.push({
          key: "music",
          title: "🎵 Music",
          lines: buckets.music,
        });
      }
      if (buckets.reddit.length) {
        sections.push({
          key: "reddit",
          title: "📡 Reddit & Social",
          lines: buckets.reddit,
        });
      }
      if (buckets.other.length) {
        sections.push({
          key: "other",
          title: "🧩 Other & Misc",
          lines: buckets.other,
        });
      }

      // Turn sections into embed fields, making sure each field <= 1024 chars
      const allFields = [];
      for (const section of sections) {
        const { title, lines } = section;

        let currentChunk = [];
        let currentLength = 0;

        for (const line of lines) {
          const lineLength = line.length + 1; // + newline
          if (currentLength + lineLength > 900 && currentChunk.length > 0) {
            // push current chunk as a field
            allFields.push({
              name:
                allFields.length === 0 ||
                !allFields[allFields.length - 1].name.startsWith(title)
                  ? title
                  : `${title} (cont.)`,
              value: currentChunk.join("\n"),
            });
            currentChunk = [];
            currentLength = 0;
          }

          currentChunk.push(line);
          currentLength += lineLength;
        }

        if (currentChunk.length > 0) {
          allFields.push({
            name:
              allFields.length === 0 ||
              !allFields[allFields.length - 1].name.startsWith(title)
                ? title
                : `${title} (cont.)`,
            value: currentChunk.join("\n"),
          });
        }
      }

      if (!allFields.length) {
        return interaction.reply({
          content: "❌ I couldn't build the help menu.",
          ephemeral: true,
        });
      }

      // Paginate fields across multiple embeds
      const fieldsPerPage = 3;
      const pages = [];
      for (let i = 0; i < allFields.length; i += fieldsPerPage) {
        const slice = allFields.slice(i, i + fieldsPerPage);
        const pageIndex = pages.length;
        const totalPages = Math.ceil(allFields.length / fieldsPerPage) || 1;

        const embed = new EmbedBuilder()
          .setTitle(`📖 AFTIES BOT — Help (${pageIndex + 1}/${totalPages})`)
          .setDescription(
            `Hello, ${user}. Here are my commands, grouped by category:`,
          )
          .addFields(slice)
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

      if (pages.length === 1) return;

      const filter = (i) =>
        i.user.id === user.id &&
        i.customId.startsWith("help_") &&
        i.message.id === message.id;

      const collector = message.createMessageComponentCollector({
        filter,
        time: 60_000,
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
