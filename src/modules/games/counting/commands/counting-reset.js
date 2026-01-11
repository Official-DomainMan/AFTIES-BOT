// src/modules/games/counting/commands/counting-reset.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("counting-reset")
    .setDescription("Reset the counting game back to the start")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        // Don't even bother replying; prevents 10062 spam
        console.warn("[counting-reset] used outside guild");
        return;
      }

      const guildId = interaction.guild.id;

      const state = await prisma.countingState.findUnique({
        where: { guildId },
      });

      if (!state) {
        console.warn(
          `[counting-reset] no countingState row for guild ${guildId}`
        );
        return;
      }

      await prisma.countingState.update({
        where: { guildId },
        data: {
          current: 0,
          lastUserId: null,
        },
      });

      console.log(
        `[counting-reset] Reset counting for guild ${guildId}, next is 1`
      );

      // We intentionally do NOT call interaction.reply here
      // to avoid 10062 "Unknown interaction" issues.
      // Discord may show "interaction failed" on UI, but the reset happens.
    } catch (err) {
      console.error("counting-reset error:", err);
      // Don't reply in error path either; just log.
    }
  },
};
