const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");
const { prisma } = require("../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("levelroles")
    .setDescription("Configure automatic level-up role rewards.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Give a role when a user reaches a specific level.")
        .addIntegerOption((opt) =>
          opt
            .setName("level")
            .setDescription("Level required for this role.")
            .setRequired(true)
            .setMinValue(1)
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role to give at that level.")
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a level/role reward.")
        .addIntegerOption((opt) =>
          opt
            .setName("level")
            .setDescription("Level to remove the reward from.")
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show all level role rewards in this server.")
    ),

  async execute(interaction) {
    // Safety: only run in guilds
    if (!interaction.guild) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "This command only works in servers.",
          ephemeral: true,
        });
      }
      return;
    }

    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const guildId = guild.id;

    try {
      if (sub === "add") {
        const level = interaction.options.getInteger("level", true);
        const role = interaction.options.getRole("role", true);

        // Basic safety checks
        if (role.id === guildId) {
          return interaction.reply({
            content: "❌ You can’t use @everyone as a level reward.",
            ephemeral: true,
          });
        }

        const me = guild.members.me;
        if (me && me.roles.highest.position <= role.position) {
          return interaction.reply({
            content:
              "❌ I can’t manage that role. Move my highest role **above** the reward role.",
            ephemeral: true,
          });
        }

        // Upsert into LevelRoleReward using the composite key (guildId, level)
        const reward = await prisma.levelRoleReward.upsert({
          where: {
            guildId_level: {
              guildId,
              level,
            },
          },
          update: {
            roleId: role.id,
          },
          create: {
            guildId,
            level,
            roleId: role.id,
          },
        });

        return interaction.reply({
          content: `✅ When someone hits **level ${reward.level}**, they’ll get the role ${role}.`,
          ephemeral: true,
        });
      }

      if (sub === "remove") {
        const level = interaction.options.getInteger("level", true);

        try {
          const deleted = await prisma.levelRoleReward.delete({
            where: {
              guildId_level: {
                guildId,
                level,
              },
            },
          });

          return interaction.reply({
            content: `✅ Removed level role reward for **level ${deleted.level}**.`,
            ephemeral: true,
          });
        } catch (err) {
          // P2025 = record not found
          if (err.code === "P2025") {
            return interaction.reply({
              content: `❌ There is no reward configured for **level ${level}**.`,
              ephemeral: true,
            });
          }

          console.error("[levelroles/remove] prisma error:", err);
          return interaction.reply({
            content: "❌ Error removing level reward. Try again later.",
            ephemeral: true,
          });
        }
      }

      if (sub === "list") {
        const rewards = await prisma.levelRoleReward.findMany({
          where: { guildId },
          orderBy: { level: "asc" },
        });

        if (!rewards.length) {
          return interaction.reply({
            content: "📭 No level role rewards configured yet.",
            ephemeral: true,
          });
        }

        const lines = rewards.map((r) => {
          const mention = `<@&${r.roleId}>`;
          return `• Level **${r.level}** → ${mention}`;
        });

        const embed = new EmbedBuilder()
          .setTitle("🎚️ Level Role Rewards")
          .setDescription(lines.join("\n"))
          .setColor(0x9b59b6)
          .setFooter({
            text: `Server: ${guild.name}`,
          })
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          ephemeral: true,
        });
      }

      // Fallback, should never hit
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Unknown subcommand.",
          ephemeral: true,
        });
      }
    } catch (err) {
      console.error("[levelroles] unexpected error:", err);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "❌ Error handling level role command.",
          ephemeral: true,
        });
      }
      // IMPORTANT: do NOT rethrow, so the global interactionCreate
      // handler doesn’t try to reply again and cause 10062/40060 spam.
    }
  },
};
