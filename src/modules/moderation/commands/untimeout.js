const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../core/database");
const { postModLog } = require("../modlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove a user's timeout")
    .addUserOption((o) =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user", true);
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";

    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);
    if (!member) {
      await interaction.editReply("❌ That user isn’t in this server.");
      return;
    }

    await member.timeout(null, reason);

    await prisma.infraction.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        modId: interaction.user.id,
        type: "timeout",
        reason: `Removed timeout: ${reason}`,
        meta: { removed: true },
      },
    });

    await postModLog(
      interaction.client,
      interaction.guild.id,
      `✅ **Untimeout** • <@${user.id}> by <@${interaction.user.id}>\n> ${reason}`
    );

    await interaction.editReply(`✅ Removed timeout for <@${user.id}>.`);
  },
};
