const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../core/database");
const { postModLog } = require("../modlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("note")
    .setDescription("Add a private staff note to a user")
    .addUserOption((o) =>
      o.setName("user").setDescription("User").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("note").setDescription("Note text").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("user", true);
    const note = interaction.options.getString("note", true);

    const inf = await prisma.infraction.create({
      data: {
        guildId: interaction.guild.id,
        userId: user.id,
        modId: interaction.user.id,
        type: "note",
        reason: note,
      },
    });

    await postModLog(
      interaction.client,
      interaction.guild.id,
      `📝 **Staff note added** • <@${user.id}> by <@${interaction.user.id}> • \`${inf.id}\``
    );

    await interaction.editReply(
      `✅ Note saved for <@${user.id}>. (id: \`${inf.id}\`)`
    );
  },
};
