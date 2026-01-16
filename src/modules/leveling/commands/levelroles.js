// src/modules/leveling/commands/levelroles.js
const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levelroles")
    .setDescription("Configure level-based role rewards.")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add or update a role reward for a level.")
        .addIntegerOption((opt) =>
          opt
            .setName("level")
            .setDescription("Level to reward.")
            .setRequired(true)
            .setMinValue(1)
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role to give at this level.")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a role reward for a level.")
        .addIntegerOption((opt) =>
          opt
            .setName("level")
            .setDescription("Level to remove reward for.")
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("List all level role rewards for this server.")
    ),

  async execute(interaction) {
    try {
      const guild = interaction.guild;
      if (!guild) {
        return interaction.reply({
          content: "This command can only be used in a server.",
          ephemeral: true,
        });
      }

      // Require Manage Roles permission
      if (
        !interaction.memberPermissions?.has(
          PermissionsBitField.Flags.ManageRoles
        )
      ) {
        return interaction.reply({
          content: "❌ You need the **Manage Roles** permission to use this.",
          ephemeral: true,
        });
      }

      const sub = interaction.options.getSubcommand();
      const guildId = guild.id;

      if (sub === "add") {
        const level = interaction.options.getInteger("level", true);
        const role = interaction.options.getRole("role", true);

        await prisma.levelRole.upsert({
          where: {
            guildId_level: {
              guildId,
              level,
            },
          },
          create: {
            guildId,
            level,
            roleId: role.id,
          },
          update: {
            roleId: role.id,
          },
        });

        const embed = new EmbedBuilder()
          .setTitle("✅ Level Role Saved")
          .setColor(0xff66cc)
          .setDescription(
            `At level **${level}**, members will receive role ${role}.`
          )
          .setFooter({
            text: "Make sure AFTIES has Manage Roles and is above that role.",
          });

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (sub === "remove") {
        const level = interaction.options.getInteger("level", true);

        await prisma.levelRole.deleteMany({
          where: { guildId, level },
        });

        return interaction.reply({
          content: `🗑️ Removed level reward for level **${level}** (if it existed).`,
          ephemeral: true,
        });
      }

      if (sub === "list") {
        const rewards = await prisma.levelRole.findMany({
          where: { guildId },
          orderBy: { level: "asc" },
        });

        if (rewards.length === 0) {
          return interaction.reply({
            content: "No level role rewards set yet.",
            ephemeral: true,
          });
        }

        const lines = rewards.map((r) => {
          const role = guild.roles.cache.get(r.roleId);
          const roleDisplay = role
            ? role.toString()
            : `\`(missing role ${r.roleId})\``;
          return `• Level **${r.level}** → ${roleDisplay}`;
        });

        const embed = new EmbedBuilder()
          .setTitle("🎖 Level Role Rewards")
          .setColor(0xff66cc)
          .setDescription(lines.join("\n"));

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (err) {
      console.error("[levelroles] error:", err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error handling level role command.",
          ephemeral: true,
        });
      } else {
        await interaction.editReply({
          content: "❌ Error handling level role command.",
        });
      }
    }
  },
};
