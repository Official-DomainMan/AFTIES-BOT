const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lastletter-disable")
    .setDescription("Disable the Last Letter game for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      await prisma.lastLetterState.delete({
        where: { guildId: interaction.guild.id },
      });
      await interaction.editReply("✅ Last Letter disabled.");
    } catch (err) {
      await interaction.editReply("ℹ️ Last Letter wasn’t enabled.");
    }
  },
};
