const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("counting-disable")
    .setDescription("Disable the Counting game for this server")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      await prisma.countingState.delete({
        where: { guildId: interaction.guild.id },
      });
      await interaction.editReply("✅ Counting disabled.");
    } catch (err) {
      await interaction.editReply("ℹ️ Counting wasn’t enabled.");
    }
  },
};
