const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("counting-reset")
    .setDescription("Reset the counting game back to 0 (next number will be 1)")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      await prisma.countingState.update({
        where: { guildId: interaction.guild.id },
        data: { current: 0, lastUserId: null },
      });

      await interaction.editReply("✅ Counting reset. Next number is **1**.");
    } catch (err) {
      console.error("counting-reset error:", err);
      await interaction.editReply(
        "❌ Counting isn’t enabled yet. Use `/counting-set` first."
      );
    }
  },
};
