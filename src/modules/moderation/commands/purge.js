const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../core/database");
const { postModLog } = require("../modlog");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Bulk delete messages in this channel")
    .addIntegerOption((o) =>
      o.setName("amount").setDescription("1-100").setRequired(true)
    )
    .addStringOption((o) =>
      o.setName("reason").setDescription("Reason").setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const amountRaw = interaction.options.getInteger("amount", true);
    const amount = Math.max(1, Math.min(100, amountRaw));
    const reason =
      interaction.options.getString("reason") ?? "No reason provided";

    const deleted = await interaction.channel
      .bulkDelete(amount, true)
      .catch(() => null);
    const count = deleted ? deleted.size : 0;

    await prisma.infraction.create({
      data: {
        guildId: interaction.guild.id,
        userId: interaction.user.id, // actor
        modId: interaction.user.id,
        type: "purge",
        reason,
        meta: {
          channelId: interaction.channel.id,
          requested: amount,
          deleted: count,
        },
      },
    });

    await postModLog(
      interaction.client,
      interaction.guild.id,
      `🧹 **Purge** • <@${interaction.user.id}> deleted **${count}** in <#${interaction.channel.id}>\n> ${reason}`
    );

    await interaction.editReply(`✅ Deleted **${count}** messages.`);
  },
};
