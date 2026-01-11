// src/modules/games/counting/commands/counting-set.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("counting-set")
    .setDescription("Set up or change the counting game channel")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("Text channel where the counting game will be played")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        // Don't reply, just silently ignore if somehow used in DMs
        console.warn("[counting-set] used outside guild");
        return;
      }

      const guildId = interaction.guild.id;
      const channel = interaction.options.getChannel("channel", true);

      // Upsert state row
      const state = await prisma.countingState.upsert({
        where: { guildId },
        update: {
          channelId: channel.id,
          // don't touch current / lastUserId when changing channel
        },
        create: {
          guildId,
          channelId: channel.id,
          current: 0,
          lastUserId: null,
        },
      });

      // Try to reply once. If Discord says "Unknown interaction", just log and move on.
      try {
        await interaction.reply({
          content: `✅ Counting channel set to ${channel}. Next number is **${
            state.current + 1
          }**.`,
          ephemeral: true,
        });
      } catch (err) {
        console.error("[counting-set] reply failed:", err);
      }
    } catch (err) {
      console.error("counting-set error:", err);
      // Don't rethrow — we don't want to crash the client
      // and interactionCreate will try to send a generic error reply if it can.
    }
  },
};
