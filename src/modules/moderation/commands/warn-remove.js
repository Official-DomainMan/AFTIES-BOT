const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../core/database");
const { postModLog } = require("../modlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("warn-remove")
    .setDescription("Remove an infraction by id")
    .addStringOption((o) =>
      o.setName("id").setDescription("Infraction id").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const id = interaction.options.getString("id", true);

    const found = await prisma.infraction.findUnique({ where: { id } });
    if (!found || found.guildId !== interaction.guild.id) {
      await interaction.editReply("❌ Infraction not found in this server.");
      return;
    }

    await prisma.infraction.delete({ where: { id } });

    await postModLog(
      interaction.client,
      interaction.guild.id,
      `🧽 **Infraction removed** • id \`${id}\` • by <@${interaction.user.id}> • user <@${found.userId}>`
    );

    await interaction.editReply(`✅ Removed infraction \`${id}\`.`);
  },
};
