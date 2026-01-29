const fs = require("fs");
const path = require("path");
const {
  ChannelType,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require("discord.js");

const { prisma } = require("../../core/database");
const { ticketControlsRow } = require("./components");

const EPHEMERAL_FLAGS = 64; // MessageFlags.Ephemeral

async function getSettings(guildId) {
  // If TicketSettings table doesn't exist yet, this will throw.
  // We'll treat missing settings as "not configured" and still allow basic ticketing.
  try {
    return await prisma.ticketSettings.findUnique({ where: { guildId } });
  } catch {
    return null;
  }
}

async function ensureOneOpenTicket(guildId, ownerId) {
  try {
    const existing = await prisma.ticket.findFirst({
      where: { guildId, ownerId, isOpen: true },
    });
    return existing;
  } catch {
    return null;
  }
}

async function createTicketChannel(guild, ownerId, settings) {
  const owner = await guild.members.fetch(ownerId).catch(() => null);

  const overwrites = [
    {
      id: guild.roles.everyone,
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

  // Optional: support role access
  if (settings?.supportRoleId) {
    overwrites.push({
      id: settings.supportRoleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages,
      ],
    });
  } else {
    // fallback: server owner can view
    overwrites.push({
      id: guild.ownerId,
      allow: [PermissionFlagsBits.ViewChannel],
    });
  }

  const channelName = `ticket-${ownerId}`;

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: settings?.categoryId ?? null,
    permissionOverwrites: overwrites,
  });

  // Nice first message
  const mention = `<@${ownerId}>`;
  await channel.send({
    content:
      `🎟️ **Support Ticket Opened**\n\n` +
      `Welcome ${mention}. Describe what you need help with.\n` +
      `A support member will reply soon.\n\n` +
      `Use the buttons below:\n` +
      `• **Claim** (staff)\n• **Transcript**\n• **Close**`,
    components: [ticketControlsRow()],
  });

  // Helpful ping (optional)
  if (settings?.supportRoleId) {
    await channel.send({
      content: `<@&${settings.supportRoleId}> new ticket: ${mention}`,
      allowedMentions: { roles: [settings.supportRoleId], users: [ownerId] },
    });
  }

  return channel;
}

async function createTicket(interaction) {
  const { guild, user } = interaction;
  if (!guild) {
    return interaction.reply({
      content: "This only works in servers.",
      flags: EPHEMERAL_FLAGS,
    });
  }

  const guildId = guild.id;
  const ownerId = user.id;

  const existing = await ensureOneOpenTicket(guildId, ownerId);
  if (existing?.channelId) {
    const ch = guild.channels.cache.get(existing.channelId);
    return interaction.reply({
      content: ch
        ? `❌ You already have an open ticket: ${ch}`
        : "❌ You already have an open ticket.",
      flags: EPHEMERAL_FLAGS,
    });
  }

  const settings = await getSettings(guildId);

  const channel = await createTicketChannel(guild, ownerId, settings);

  // Save ticket in DB (best effort; if model missing, ticket still works)
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

  return interaction.reply({
    content: `✅ Ticket created: ${channel}`,
    flags: EPHEMERAL_FLAGS,
  });
}

async function claimTicket(interaction) {
  const { guild, channel, user } = interaction;
  if (!guild || !channel) return;

  // Update DB (best effort)
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

  return interaction.reply({
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

  // oldest -> newest
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
      `🧾 **Ticket Transcript**\n` +
      `• Channel: <#${ticketChannel.id}>\n` +
      `• Owner: <@${meta.ownerId}>\n` +
      (meta.claimedById ? `• Claimed: <@${meta.claimedById}>\n` : "") +
      (meta.reason ? `• Close reason: ${meta.reason}\n` : ""),
    files: [file],
    allowedMentions: { users: [] },
  });

  // cleanup
  try {
    fs.unlinkSync(tmpPath);
  } catch {}
}

async function transcriptTicket(interaction) {
  const { guild, channel } = interaction;
  if (!guild || !channel) return;

  const text = await fetchAllMessagesText(channel, 1000);

  // best effort: include meta if exists
  let meta = { ownerId: "unknown", claimedById: null, reason: null };
  try {
    const t = await prisma.ticket.findUnique({
      where: { channelId: channel.id },
    });
    if (t)
      meta = {
        ownerId: t.ownerId,
        claimedById: t.claimedById,
        reason: t.closeReason ?? null,
      };
  } catch {}

  await sendTranscriptToLog(guild, channel, text, meta);

  return interaction.reply({
    content: "✅ Transcript sent to the log channel (if configured).",
    flags: EPHEMERAL_FLAGS,
  });
}

async function closeTicket(interaction, reason) {
  const { guild, channel, user } = interaction;
  if (!guild || !channel) return;

  // Pull ticket meta (best effort)
  let ticket = null;
  try {
    ticket = await prisma.ticket.findUnique({
      where: { channelId: channel.id },
    });
  } catch {}

  const ownerId = ticket?.ownerId ?? "unknown";
  const claimedById = ticket?.claimedById ?? null;

  // transcript first
  const transcriptText = await fetchAllMessagesText(channel, 1000);
  await sendTranscriptToLog(guild, channel, transcriptText, {
    ownerId,
    claimedById,
    reason,
  });

  // update DB (best effort)
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

  // Acknowledge quickly, then delete
  await interaction.reply({
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
