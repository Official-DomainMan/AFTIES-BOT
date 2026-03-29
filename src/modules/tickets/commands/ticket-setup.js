const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  EmbedBuilder,
} = require("discord.js");
const { prisma } = require("../../../core/database");

function respond(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket-setup")
    .setDescription(
      "Configure ticket system settings (category, support role, log channel).",
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((o) =>
      o
        .setName("category")
        .setDescription("Category where ticket channels will be created")
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false),
    )
    .addRoleOption((o) =>
      o
        .setName("support_role")
        .setDescription("Role that can view and respond to tickets")
        .setRequired(false),
    )
    .addChannelOption((o) =>
      o
        .setName("log_channel")
        .setDescription("Channel where transcripts will be posted")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      if (!interaction.guild) {
        return respond(interaction, {
          content: "❌ Server only.",
        });
      }

      const guild = interaction.guild;
      const guildId = guild.id;

      const botMember =
        guild.members.me ?? (await guild.members.fetchMe().catch(() => null));

      if (!botMember) {
        return respond(interaction, {
          content: "❌ I couldn't resolve my bot member in this server.",
        });
      }

      const category = interaction.options.getChannel("category");
      const supportRole = interaction.options.getRole("support_role");
      const logChannel = interaction.options.getChannel("log_channel");

      const validationProblems = [];
      const validationWarnings = [];

      if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        validationProblems.push(
          "I am missing **Manage Channels** at the server level.",
        );
      }

      if (category) {
        if (category.type !== ChannelType.GuildCategory) {
          validationProblems.push(
            "The selected category is not a valid category.",
          );
        } else {
          const categoryPerms = category.permissionsFor(botMember);

          if (!categoryPerms?.has(PermissionFlagsBits.ViewChannel)) {
            validationProblems.push(
              `I cannot **View Channel** in ${category}.`,
            );
          }

          if (!categoryPerms?.has(PermissionFlagsBits.ManageChannels)) {
            validationProblems.push(
              `I cannot **Manage Channels** in ${category}.`,
            );
          }
        }
      }

      if (logChannel) {
        const logPerms = logChannel.permissionsFor(botMember);

        if (!logPerms?.has(PermissionFlagsBits.ViewChannel)) {
          validationProblems.push(
            `I cannot **View Channel** in ${logChannel}.`,
          );
        }

        if (!logPerms?.has(PermissionFlagsBits.SendMessages)) {
          validationProblems.push(
            `I cannot **Send Messages** in ${logChannel}.`,
          );
        }

        if (!logPerms?.has(PermissionFlagsBits.AttachFiles)) {
          validationWarnings.push(
            `I cannot **Attach Files** in ${logChannel}, so transcript uploads may fail.`,
          );
        }
      }

      if (supportRole) {
        if (!guild.roles.cache.has(supportRole.id)) {
          validationProblems.push("The selected support role does not exist.");
        }

        if (supportRole.managed) {
          validationWarnings.push(
            `${supportRole} is an integration-managed role. Double-check that this is intentional.`,
          );
        }
      }

      if (validationProblems.length > 0) {
        const embed = new EmbedBuilder()
          .setTitle("❌ Ticket setup failed validation")
          .setDescription(
            "Fix these permission/configuration issues, then run `/ticket-setup` again.",
          )
          .addFields({
            name: "Problems",
            value: validationProblems
              .map((x) => `• ${x}`)
              .join("\n")
              .slice(0, 1024),
          })
          .setTimestamp();

        if (validationWarnings.length > 0) {
          embed.addFields({
            name: "Warnings",
            value: validationWarnings
              .map((x) => `• ${x}`)
              .join("\n")
              .slice(0, 1024),
          });
        }

        return respond(interaction, {
          embeds: [embed],
        });
      }

      const data = {};
      if (category) data.categoryId = category.id;
      if (supportRole) data.supportRoleId = supportRole.id;
      if (logChannel) data.logChannelId = logChannel.id;

      if (Object.keys(data).length === 0) {
        const existing = await prisma.ticketSettings.findUnique({
          where: { guildId },
        });

        if (!existing) {
          return respond(interaction, {
            content:
              "❌ You didn't provide any values, and no ticket settings currently exist.",
          });
        }

        const embed = new EmbedBuilder()
          .setTitle("🎟️ Current ticket settings")
          .setDescription("No changes were made.")
          .addFields(
            {
              name: "Category",
              value: existing.categoryId
                ? `<#${existing.categoryId}>`
                : "Not set",
              inline: true,
            },
            {
              name: "Support Role",
              value: existing.supportRoleId
                ? `<@&${existing.supportRoleId}>`
                : "Not set",
              inline: true,
            },
            {
              name: "Log Channel",
              value: existing.logChannelId
                ? `<#${existing.logChannelId}>`
                : "Not set",
              inline: true,
            },
          )
          .setTimestamp();

        return respond(interaction, {
          embeds: [embed],
        });
      }

      const updated = await prisma.ticketSettings.upsert({
        where: { guildId },
        update: data,
        create: { guildId, ...data },
      });

      const embed = new EmbedBuilder()
        .setTitle("✅ Ticket settings updated")
        .addFields(
          {
            name: "Category",
            value: updated.categoryId ? `<#${updated.categoryId}>` : "Not set",
            inline: true,
          },
          {
            name: "Support Role",
            value: updated.supportRoleId
              ? `<@&${updated.supportRoleId}>`
              : "Not set",
            inline: true,
          },
          {
            name: "Log Channel",
            value: updated.logChannelId
              ? `<#${updated.logChannelId}>`
              : "Not set",
            inline: true,
          },
        )
        .setTimestamp();

      if (validationWarnings.length > 0) {
        embed.addFields({
          name: "Warnings",
          value: validationWarnings
            .map((x) => `• ${x}`)
            .join("\n")
            .slice(0, 1024),
        });
      }

      return respond(interaction, {
        embeds: [embed],
      });
    } catch (err) {
      console.error("[ticket-setup] error:", err);

      return respond(interaction, {
        content: "❌ Failed to update ticket settings.",
      });
    }
  },
};
