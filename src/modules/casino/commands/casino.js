// src/modules/casino/commands/casino.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getOrCreateProfile } = require("../../economy/economy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("casino")
    .setDescription("Open the AFTIES CASINO lobby."),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      const guildId = interaction.guild.id;
      const userId = interaction.user.id;

      let profile = null;
      try {
        profile = await getOrCreateProfile(guildId, userId);
      } catch (err) {
        console.error("[casino] failed to load economy profile:", err);
      }

      const balance = profile?.balance ?? 0;

      const description = [
        `Welcome, ${interaction.user}.`,
        "",
        `**Your Balance:** ${balance.toLocaleString("en-US")} 🪙`,
        "",
        "**Available Games**",
        "`/blackjack <bet>` — classic 21",
        "`/slots <bet>` — spin the reels",
        "`/roulette <bet> <choice>` — red / black / green",
        "",
        "**Economy Commands**",
        "`/daily` — claim your daily stipend",
        "`/balance` — check your wallet",
        "`/transaction-log` — view your recent wins & losses",
        "`/levels`, `/profile` — flex your grind",
        "",
        "Gamble responsibly, menace irresponsibly.",
      ].join("\n");

      const embed = new EmbedBuilder()
        .setTitle("🎰 AFTIES CASINO LOBBY")
        .setDescription(description)
        .setColor(0x9b59b6)
        .setFooter({ text: "House always wins… eventually." });

      await interaction.reply({
        embeds: [embed],
        ephemeral: false,
      });
    } catch (err) {
      console.error("[casino] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error opening the casino lobby.",
          ephemeral: true,
        });
      }
    }
  },
};
