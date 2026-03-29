const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  MessageFlags,
} = require("discord.js");
const { prisma } = require("../../../core/database");

function yesNo(value) {
  return value ? "Yes" : "No";
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-config")
    .setDescription("View or clear ticket system configuration")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sc) =>
      sc.setName("view").setDescription("View current ticket configuration"),
    )
    .addSubcommand((sc) =>
      sc
        .setName("clear")
        .setDescription("Clear all saved ticket configuration"),
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return interaction.reply({
          content: "❌ Server only.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const guild = interaction.guild;
      const guildId = guild.id;
      const sub = interaction.options.getSubcommand();

      if (sub === "view") {
        const settings = await prisma.ticketSettings.findUnique({
          where: { guildId },
        });

        if (!settings) {
          return interaction.reply({
            content:
              "ℹ️ No ticket configuration is currently saved for this server.",
            flags: MessageFlags.Ephemeral,
          });
        }

        const botMember =
          guild.members.me ?? (await guild.members.fetchMe().catch(() => null));

        const category = settings.categoryId
          ? (guild.channels.cache.get(settings.categoryId) ??
            (await guild.channels.fetch(settings.categoryId).catch(() => null)))
          : null;

        const logChannel = settings.logChannelId
          ? (guild.channels.cache.get(settings.logChannelId) ??
            (await guild.channels
              .fetch(settings.logChannelId)
              .catch(() => null)))
          : null;

        const supportRole = settings.supportRoleId
          ? (guild.roles.cache.get(settings.supportRoleId) ?? null)
          : null;

        let categoryHealth = "Not set";
        let logHealth = "Not set";
        let supportRoleHealth = "Not set";
        let botHealth = "Unknown";

        if (botMember) {
          botHealth = [
            `• Manage Channels: **${yesNo(
              botMember.permissions.has(PermissionFlagsBits.ManageChannels),
            )}**`,
            `• View Channels: **${yesNo(
              botMember.permissions.has(PermissionFlagsBits.ViewChannel),
            )}**`,
            `• Send Messages: **${yesNo(
              botMember.permissions.has(PermissionFlagsBits.SendMessages),
            )}**`,
            `• Read Message History: **${yesNo(
              botMember.permissions.has(PermissionFlagsBits.ReadMessageHistory),
            )}**`,
            `• Attach Files: **${yesNo(
              botMember.permissions.has(PermissionFlagsBits.AttachFiles),
            )}**`,
          ].join("\n");
        }

        if (settings.categoryId) {
          if (!category) {
            categoryHealth = "❌ Saved category is missing or inaccessible.";
          } else if (category.type !== ChannelType.GuildCategory) {
            categoryHealth = "❌ Saved category ID is not a category.";
          } else if (!botMember) {
            categoryHealth = "⚠️ Could not validate bot permissions.";
          } else {
            const perms = category.permissionsFor(botMember);
            categoryHealth = [
              `• Exists: **Yes**`,
              `• View Channel: **${yesNo(
                perms?.has(PermissionFlagsBits.ViewChannel),
              )}**`,
              `• Manage Channels: **${yesNo(
                perms?.has(PermissionFlagsBits.ManageChannels),
              )}**`,
            ].join("\n");
          }
        }

        if (settings.logChannelId) {
          if (!logChannel) {
            logHealth = "❌ Saved log channel is missing or inaccessible.";
          } else if (!botMember) {
            logHealth = "⚠️ Could not validate bot permissions.";
          } else {
            const perms = logChannel.permissionsFor(botMember);
            logHealth = [
              `• Exists: **Yes**`,
              `• View Channel: **${yesNo(
                perms?.has(PermissionFlagsBits.ViewChannel),
              )}**`,
              `• Send Messages: **${yesNo(
                perms?.has(PermissionFlagsBits.SendMessages),
              )}**`,
              `• Attach Files: **${yesNo(
                perms?.has(PermissionFlagsBits.AttachFiles),
              )}**`,
            ].join("\n");
          }
        }

        if (settings.supportRoleId) {
          if (!supportRole) {
            supportRoleHealth = "❌ Saved support role is missing.";
          } else {
            supportRoleHealth = [
              `• Exists: **Yes**`,
              `• Managed role: **${yesNo(supportRole.managed)}**`,
              `• Mentionable: **${yesNo(supportRole.mentionable)}**`,
            ].join("\n");
          }
        }

        const embed = new EmbedBuilder()
          .setTitle("🎟️ Ticket Configuration")
          .addFields(
            {
              name: "Category",
              value: settings.categoryId
                ? `${category ? `<#${settings.categoryId}>` : `\`${settings.categoryId}\``}`
                : "Not set",
              inline: true,
            },
            {
              name: "Support Role",
              value: settings.supportRoleId
                ? `${supportRole ? `<@&${settings.supportRoleId}>` : `\`${settings.supportRoleId}\``}`
                : "Not set",
              inline: true,
            },
            {
              name: "Log Channel",
              value: settings.logChannelId
                ? `${logChannel ? `<#${settings.logChannelId}>` : `\`${settings.logChannelId}\``}`
                : "Not set",
              inline: true,
            },
            {
              name: "Category Health",
              value: String(categoryHealth).slice(0, 1024),
            },
            {
              name: "Support Role Health",
              value: String(supportRoleHealth).slice(0, 1024),
            },
            {
              name: "Log Channel Health",
              value: String(logHealth).slice(0, 1024),
            },
            {
              name: "Bot Permission Snapshot",
              value: String(botHealth).slice(0, 1024),
            },
          )
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      }

      if (sub === "clear") {
        const settings = await prisma.ticketSettings.findUnique({
          where: { guildId },
        });

        if (!settings) {
          return interaction.reply({
            content: "ℹ️ There is no saved ticket configuration to clear.",
            flags: MessageFlags.Ephemeral,
          });
        }

        await prisma.ticketSettings.delete({
          where: { guildId },
        });

        const embed = new EmbedBuilder()
          .setTitle("🗑️ Ticket Configuration Cleared")
          .setDescription(
            "All saved ticket settings for this server have been removed.",
          )
          .addFields(
            {
              name: "Cleared Category",
              value: settings.categoryId
                ? `\`${settings.categoryId}\``
                : "None",
              inline: true,
            },
            {
              name: "Cleared Support Role",
              value: settings.supportRoleId
                ? `\`${settings.supportRoleId}\``
                : "None",
              inline: true,
            },
            {
              name: "Cleared Log Channel",
              value: settings.logChannelId
                ? `\`${settings.logChannelId}\``
                : "None",
              inline: true,
            },
          )
          .setTimestamp();

        return interaction.reply({
          embeds: [embed],
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: "❌ Unknown subcommand.",
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error("[ticket-config] error:", error);

      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({
          content: "❌ Failed to run `/ticket-config`.",
        });
      }

      return interaction.reply({
        content: "❌ Failed to run `/ticket-config`.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
