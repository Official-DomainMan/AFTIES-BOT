const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("counting-set")
    .setDescription("Set the channel for the Counting game")
    .addChannelOption((o) =>
      o.setName("channel").setDescription("Game channel").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply(); // visible reply

    try {
      const channel = interaction.options.getChannel("channel", true);

      await prisma.countingState.upsert({
        where: { guildId: interaction.guild.id },
        update: { channelId: channel.id, current: 0, lastUserId: null },
        create: {
          guildId: interaction.guild.id,
          channelId: channel.id,
          current: 0,
          lastUserId: null,
        },
      });

      await interaction.editReply(
        `✅ Counting enabled in ${channel} (starting at 1)`
      );
    } catch (err) {
      console.error("counting-set error:", err);
      await interaction.editReply(
        "❌ Couldn’t save counting state to the database."
      );
    }
  },
};
