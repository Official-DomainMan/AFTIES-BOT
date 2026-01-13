// src/modules/games/lastletter/commands/lastletter-reset.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lastletter-reset")
    .setDescription("Reset the Last Letter game for this server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ This command can only be used in a server.",
        ephemeral: true,
      });
    }

    const guildId = interaction.guild.id;

    try {
      const state = await prisma.lastLetterState.findUnique({
        where: { guildId },
      });

      if (!state) {
        // If there is no state yet, create a fresh one bound to this channel
        await prisma.lastLetterState.create({
          data: {
            guildId,
            channelId: interaction.channelId,
            lastWord: "",
            lastLetter: null,
            usedWords: [],
            currentStreak: 0,
            bestStreak: 0, // set to 0 on first create; you can change this if desired
          },
        });

        return interaction.reply({
          content:
            "🔄 Last Letter game has been initialized and reset for this channel.",
          ephemeral: true,
        });
      }

      // Reset existing state. Here we **reset currentStreak but KEEP bestStreak**.
      await prisma.lastLetterState.update({
        where: { guildId },
        data: {
          lastWord: "",
          lastLetter: null,
          usedWords: [],
          currentStreak: 0,
          // If you want to wipe history entirely, also set bestStreak: 0 here.
        },
      });

      return interaction.reply({
        content:
          "🔁 Last Letter game has been reset.\nCurrent streak cleared. Best streak **kept**.",
        ephemeral: true,
      });
    } catch (err) {
      console.error("lastletter-reset error:", err);
      // Try to respond once (no deferReply here, so we can safely reply)
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({
            content: "❌ Error resetting Last Letter game.",
            ephemeral: true,
          });
        } catch {
          // ignore if Discord complains
        }
      }
    }
  },
};
