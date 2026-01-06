const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lastletter-set")
    .setDescription("Set the channel for the Last Letter game")
    .addChannelOption((o) =>
      o.setName("channel").setDescription("Game channel").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    // ACK immediately so Discord never times out
    await interaction.deferReply();

    try {
      const channel = interaction.options.getChannel("channel", true);

      await prisma.lastLetterState.upsert({
        where: { guildId: interaction.guild.id },
        update: { channelId: channel.id },
        create: { guildId: interaction.guild.id, channelId: channel.id },
      });

      await interaction.editReply(`✅ Last Letter enabled in ${channel}`);
    } catch (err) {
      console.error("lastletter-set error:", err);
      await interaction.editReply(
        "❌ DB save failed. Check DATABASE_URL (public host + sslmode=require)."
      );
    }
  },
};
