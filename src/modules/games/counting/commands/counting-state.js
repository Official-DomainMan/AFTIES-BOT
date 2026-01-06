const { SlashCommandBuilder } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("counting-state")
    .setDescription(
      "Show the current counting number and the next expected number"
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const state = await prisma.countingState.findUnique({
      where: { guildId: interaction.guild.id },
    });

    if (!state) {
      await interaction.editReply(
        "ℹ️ Counting isn’t enabled. Use `/counting-set` first."
      );
      return;
    }

    await interaction.editReply(
      `📈 Counting is enabled in <#${state.channelId}>.\nCurrent: **${
        state.current
      }**\nNext: **${state.current + 1}**`
    );
  },
};
