const { SlashCommandBuilder } = require("discord.js");
const { prisma } = require("../../../core/database");
const { postModLog } = require("../modlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("appeal")
    .setDescription("Submit a moderation appeal")
    .addStringOption((o) =>
      o.setName("message").setDescription("Appeal message").setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const msg = interaction.options.getString("message", true);

    const inf = await prisma.infraction.create({
      data: {
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        modId: interaction.user.id,
        type: "appeal",
        reason: msg,
      },
    });

    await postModLog(
      interaction.client,
      interaction.guild.id,
      `📨 **Appeal submitted** • <@${interaction.user.id}> • id \`${inf.id}\`\n> ${msg}`
    );

    await interaction.editReply("✅ Appeal submitted.");
  },
};
