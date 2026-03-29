const fs = require("fs");
const path = require("path");
const {
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const { prisma } = require("../../core/database");
const { ticketControlsRow } = require("./components");

const EPHEMERAL_FLAGS = MessageFlags.Ephemeral;

function replyOrEdit(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

async function getSettings(guildId) {
  try {
    return await prisma.ticketSettings.findUnique({ where: { guildId } });
  } catch {
    return null;
  }
}

async function ensureOneOpenTicket(guildId, ownerId) {
  try {
    return await prisma.ticket.findFirst({
      where: { guildId, ownerId, isOpen: true },
    });
  } catch {
    return null;
  }
}

async function validateTicketContext(guild, settings) {
  const botMember =
    guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!botMember) {
    return {
      ok: false,
      message: "❌ I couldn't resolve my bot member in this server.",
    };
  }

  if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
    return {
      ok: false,
      message:
        "❌ I am missing **Manage Channels** at the server level. Give the bot role Manage Channels and try again.",
    };
  }

  let parent = null;
  if (settings?.categoryId) {
    parent =
      guild.channels.cache.get(settings.categoryId) ??
      (await guild.channels.fetch(settings.categoryId).catch(() => null));

    if (!parent) {
      return {
        ok: true,
        parent: null,
        supportRoleId: settings?.supportRoleId ?? null,
        warning:
          "⚠️ The configured ticket category no longer exists or is inaccessible. I will create the ticket without a category parent.",
      };
    }

    if (parent.type !== ChannelType.GuildCategory) {
      return {
        ok: true,
        parent: null,
        supportRoleId: settings?.supportRoleId ?? null,
        warning:
          "⚠️ The configured ticket category is not actually a category. I will create the ticket without a category parent.",
      };
    }

    const permsInParent = parent.permissionsFor(botMember);
    if (
      !permsInParent ||
      !permsInParent.has(PermissionFlagsBits.ViewChannel) ||
      !permsInParent.has(PermissionFlagsBits.ManageChannels)
    ) {
      return {
        ok: false,
        message:
          `❌ I do not have access to create channels inside the configured ticket category <#${parent.id}>.\n` +
          `Give the bot role **View Channel** and **Manage Channels** in that category, or reconfigure the ticket category.`,
      };
    }
  }

  let supportRoleId = null;
  if (settings?.supportRoleId) {
    const role = guild.roles.cache.get(settings.supportRoleId) ?? null;
    if (role) {
      supportRoleId = role.id;
    }
  }

  return {
    ok: true,
    parent,
    supportRoleId,
    warning: null,
  };
}

async function createTicketChannel(guild, ownerId, settings) {
  const owner = await guild.members.fetch(ownerId).catch(() => null);
  const validation = await validateTicketContext(guild, settings);

  if (!validation.ok) {
    const err = new Error(validation.message);
    err.userSafeMessage = validation.message;
    throw err;
  }

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: ownerId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  if (validation.supportRoleId) {
    overwrites.push({
      id: validation.supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  } else {
    overwrites.push({
      id: guild.ownerId,
      allow: [PermissionFlagsBits.ViewChannel],
    });
  }

  const channelName = `ticket-${ownerId}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: validation.parent?.id ?? null,
    permissionOverwrites: overwrites,
  });

  const mention = `<@${ownerId}>`;

  let intro = [
    "🎫 **Support Ticket Opened**",
    "",
    `Welcome ${mention}.`,
    "Describe what you need help with.",
    "A support member will reply soon.",
    "",
    "Use the buttons below:",
    "• **Claim** (staff)",
    "• **Transcript**",
    "• **Close**",
  ].join("\n");

  if (validation.warning) {
    intro += `\n\n${validation.warning}`;
  }

  await channel.send({
    content: intro,
    components: [ticketControlsRow()],
  });

  if (validation.supportRoleId) {
    await channel.send({
      content: `<@&${validation.supportRoleId}> new ticket: ${mention}`,
      allowedMentions: {
        roles: [validation.supportRoleId],
        users: [ownerId],
      },
    });
  }

  return channel;
}

async function createTicket(interaction) {
  const { guild, user } = interaction;

  if (!guild) {
    return replyOrEdit(interaction, {
      content: "This only works in servers.",
      flags: EPHEMERAL_FLAGS,
    });
  }

  const guildId = guild.id;
  const ownerId = user.id;

  const existing = await ensureOneOpenTicket(guildId, ownerId);
  if (existing?.channelId) {
    const ch =
      guild.channels.cache.get(existing.channelId) ??
      (await guild.channels.fetch(existing.channelId).catch(() => null));

    return replyOrEdit(interaction, {
      content: ch
        ? `❌ You already have an open ticket: ${ch}`
        : "❌ You already have an open ticket.",
      flags: EPHEMERAL_FLAGS,
    });
  }

  const settings = await getSettings(guildId);

  try {
    const channel = await createTicketChannel(guild, ownerId, settings);

    try {
      await prisma.ticket.create({
        data: {
          guildId,
          channelId: channel.id,
          ownerId,
          isOpen: true,
        },
      });
    } catch (err) {
      console.warn("[tickets] ticket DB save skipped/failed:", err?.message);
    }

    return replyOrEdit(interaction, {
      content: `✅ Ticket created: ${channel}`,
      flags: EPHEMERAL_FLAGS,
    });
  } catch (error) {
    console.error("[tickets:createTicket]", error);

    return replyOrEdit(interaction, {
      content:
        error.userSafeMessage ||
        "❌ I couldn't create the ticket channel. Check my category permissions, Manage Channels permission, and ticket configuration.",
      flags: EPHEMERAL_FLAGS,
    });
  }
}

async function claimTicket(interaction) {
  const { guild, channel, user } = interaction;
  if (!guild || !channel) return;

  try {
    await prisma.ticket.update({
      where: { channelId: channel.id },
      data: { claimedById: user.id },
    });
  } catch {}

  await channel.send({
    content: `🧷 Ticket claimed by <@${user.id}>`,
    allowedMentions: { users: [user.id] },
  });

  return replyOrEdit(interaction, {
    content: "✅ Claimed.",
    flags: EPHEMERAL_FLAGS,
  });
}

async function fetchAllMessagesText(channel, maxMessages = 1000) {
  let lastId = undefined;
  let all = [];

  while (all.length < maxMessages) {
    const batch = await channel.messages.fetch({
      limit: 100,
      before: lastId,
    });

    if (!batch.size) break;

    const arr = Array.from(batch.values());
    all.push(...arr);
    lastId = arr[arr.length - 1].id;
  }

  all = all.reverse();

  const lines = all.map((m) => {
    const ts = new Date(m.createdTimestamp).toISOString();
    const author = `${m.author?.tag ?? "Unknown"} (${m.author?.id ?? "?"})`;
    const content = m.content?.replace(/\n/g, "\\n") ?? "";
    const attachments = m.attachments?.size
      ? ` [attachments: ${Array.from(m.attachments.values())
          .map((a) => a.url)
          .join(", ")}]`
      : "";

    return `[${ts}] ${author}: ${content}${attachments}`;
  });

  return lines.join("\n");
}

async function sendTranscriptToLog(guild, ticketChannel, transcriptText, meta) {
  const settings = await getSettings(guild.id);
  if (!settings?.logChannelId) return;

  const logChannel =
    guild.channels.cache.get(settings.logChannelId) ??
    (await guild.channels.fetch(settings.logChannelId).catch(() => null));

  if (!logChannel || !logChannel.isTextBased()) return;

  const filename = `ticket-${ticketChannel.id}.txt`;
  const tmpPath = path.join(process.cwd(), filename);

  fs.writeFileSync(tmpPath, transcriptText, "utf8");

  const file = new AttachmentBuilder(tmpPath, { name: filename });

  await logChannel.send({
    content:
      `📄 **Ticket Transcript**\n` +
      `• Channel: <#${ticketChannel.id}>\n` +
      `• Owner: <@${meta.ownerId}>\n` +
      (meta.claimedById ? `• Claimed: <@${meta.claimedById}>\n` : "") +
      (meta.reason ? `• Close reason: ${meta.reason}\n` : ""),
    files: [file],
    allowedMentions: { users: [] },
  });

  try {
    fs.unlinkSync(tmpPath);
  } catch {}
}

async function transcriptTicket(interaction) {
  const { guild, channel } = interaction;
  if (!guild || !channel) return;

  const text = await fetchAllMessagesText(channel, 1000);

  let meta = { ownerId: "unknown", claimedById: null, reason: null };

  try {
    const t = await prisma.ticket.findUnique({
      where: { channelId: channel.id },
    });

    if (t) {
      meta = {
        ownerId: t.ownerId,
        claimedById: t.claimedById,
        reason: t.closeReason ?? null,
      };
    }
  } catch {}

  await sendTranscriptToLog(guild, channel, text, meta);

  return replyOrEdit(interaction, {
    content: "✅ Transcript sent to the log channel (if configured).",
    flags: EPHEMERAL_FLAGS,
  });
}

async function closeTicket(interaction, reason) {
  const { guild, channel, user } = interaction;
  if (!guild || !channel) return;

  let ticket = null;
  try {
    ticket = await prisma.ticket.findUnique({
      where: { channelId: channel.id },
    });
  } catch {}

  const ownerId = ticket?.ownerId ?? "unknown";
  const claimedById = ticket?.claimedById ?? null;

  const transcriptText = await fetchAllMessagesText(channel, 1000);
  await sendTranscriptToLog(guild, channel, transcriptText, {
    ownerId,
    claimedById,
    reason,
  });

  try {
    await prisma.ticket.update({
      where: { channelId: channel.id },
      data: {
        isOpen: false,
        closedAt: new Date(),
        closeReason: reason ?? null,
      },
    });
  } catch {}

  await replyOrEdit(interaction, {
    content: "🗑️ Closing ticket in 5 seconds…",
    flags: EPHEMERAL_FLAGS,
  });

  await channel.send({
    content: `🔒 Ticket closed by <@${user.id}>${reason ? ` — **Reason:** ${reason}` : ""}`,
    allowedMentions: { users: [user.id] },
  });

  setTimeout(() => {
    channel.delete().catch(() => {});
  }, 5000);
}

module.exports = {
  EPHEMERAL_FLAGS,
  getSettings,
  createTicket,
  claimTicket,
  transcriptTicket,
  closeTicket,
};
