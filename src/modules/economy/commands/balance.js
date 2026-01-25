// src/modules/economy/commands/balance.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getOrCreateProfile } = require("../economy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your casino balance.")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("Whose balance to check (default: you).")
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }

      const guildId = interaction.guild.id;
      const targetUser =
        interaction.options.getUser("user") || interaction.user;
      const userId = targetUser.id;

      const profile = await getOrCreateProfile(guildId, userId);

      const embed = new EmbedBuilder()
        .setTitle("💰 Casino Balance")
        .setDescription(
          `${targetUser} has **${profile.balance.toLocaleString()}** coins.`,
        )
        .setColor(0xf1c40f)
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: false });
    } catch (err) {
      console.error("[balance] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error running /balance.",
          ephemeral: true,
        });
      }
    }
  },
};
