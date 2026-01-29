const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-setup")
    .setDescription(
      "Configure ticket system settings (category, support role, log channel).",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o
        .setName("category")
        .setDescription("Category where ticket channels will be created")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false),
    )
    .addRoleOption((o) =>
      o
        .setName("support_role")
        .setDescription("Role that can view and respond to tickets")
        .setRequired(false),
    )
    .addChannelOption((o) =>
      o
        .setName("log_channel")
        .setDescription("Channel where transcripts will be posted")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild)
        return interaction.reply({ content: "Server only.", flags: 64 });

      const guildId = interaction.guild.id;
      const category = interaction.options.getChannel("category");
      const supportRole = interaction.options.getRole("support_role");
      const logChannel = interaction.options.getChannel("log_channel");

      const data = {};
      if (category) data.categoryId = category.id;
      if (supportRole) data.supportRoleId = supportRole.id;
      if (logChannel) data.logChannelId = logChannel.id;

      // upsert settings
      await prisma.ticketSettings.upsert({
        where: { guildId },
        update: data,
        create: { guildId, ...data },
      });

      return interaction.reply({
        content:
          `✅ Ticket settings updated.\n` +
          (category ? `• Category: ${category}\n` : "") +
          (supportRole ? `• Support role: ${supportRole}\n` : "") +
          (logChannel ? `• Log channel: ${logChannel}\n` : ""),
        flags: 64,
      });
    } catch (err) {
      console.error("[ticket-setup] error:", err);
      if (!interaction.replied) {
        await interaction.reply({
          content: "❌ Failed to update ticket settings.",
          flags: 64,
        });
      }
    }
  },
};
