const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("modlog")
    .setDescription("Moderation logging")
    .addSubcommand((sc) =>
      sc
        .setName("set")
        .setDescription("Set mod log channel")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Log channel").setRequired(true)
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.options.getChannel("channel", true);

    await prisma.modConfig.upsert({
      where: { guildId: interaction.guild.id },
      update: { logChannelId: channel.id },
      create: { guildId: interaction.guild.id, logChannelId: channel.id },
    });

    await interaction.editReply(`✅ Mod log channel set to ${channel}`);
  },
};
