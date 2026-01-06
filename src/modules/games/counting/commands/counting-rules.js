const { SlashCommandBuilder } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("counting-rules")
    .setDescription("Show the rules for the Counting game"),

  async execute(interaction) {
    await interaction.deferReply(); // visible reply

    const state = await prisma.countingState.findUnique({
      where: { guildId: interaction.guild.id },
    });

    if (!state) {
      await interaction.editReply(
        "ℹ️ Counting isn’t enabled yet.\nUse `/counting-set channel:#your-channel` to enable it."
      );
      return;
    }

    const next = state.current + 1;

    await interaction.editReply(
      [
        `📍 **Counting channel:** <#${state.channelId}>`,
        ``,
        `**Rules:**`,
        `• Post **numbers only** (no text).`,
        `• You must post the **next number** (current + 1).`,
        `• **No one can count twice in a row.**`,
        `• Wrong posts get deleted (with a short hint).`,
        ``,
        `✅ **Next number:** **${next}**`,
      ].join("\n")
    );
  },
};
