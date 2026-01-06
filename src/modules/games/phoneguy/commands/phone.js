const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { prisma } = require("../../../../core/database");

// ---------- helpers ----------
async function dm(client, userId, content) {
  const user = await client.users.fetch(userId);
  return user.send(content);
}

async function safeDm(client, userId, content) {
  try {
    await dm(client, userId, content);
    return true;
  } catch {
    return false;
  }
}

async function logEvent({
  type,
  mode,
  callId,
  guildId,
  userId,
  otherUserId,
  message,
}) {
  try {
    await prisma.phoneGuyLog.create({
      data: {
        type,
        mode: mode ?? null,
        callId: callId ?? null,
        guildId: guildId ?? null,
        userId: userId ?? null,
        otherUserId: otherUserId ?? null,
        message: message ?? null,
      },
    });
  } catch {}
}

async function getGuildLogChannelId(guildId) {
  const cfg = await prisma.phoneGuyConfig.findUnique({ where: { guildId } });
  return cfg?.logChannelId ?? null;
}

async function postToLogChannel(client, guildId, text) {
  try {
    const channelId = await getGuildLogChannelId(guildId);
    if (!channelId) return;

    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const ch = await guild.channels.fetch(channelId).catch(() => null);
    if (!ch || !ch.isTextBased()) return;

    await ch.send(text);
  } catch {}
}

async function getActiveCallForUser(userId) {
  return prisma.phoneGuyCall.findFirst({
    where: { status: "active", OR: [{ userAId: userId }, { userBId: userId }] },
  });
}

function otherParty(call, userId) {
  const isA = call.userAId === userId;
  return {
    otherUserId: isA ? call.userBId : call.userAId,
    otherGuildId: isA ? call.guildBId : call.guildAId,
  };
}

async function isBlockedEitherWay(userId, otherUserId) {
  const hit = await prisma.phoneGuyBlock.findFirst({
    where: {
      OR: [
        { blockerId: userId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: userId },
      ],
    },
  });
  return !!hit;
}

// cooldown: seconds between /phone startcall attempts
const STARTCALL_COOLDOWN_SECONDS = 60;

async function checkAndSetCooldown(userId) {
  const now = new Date();
  const row = await prisma.phoneGuyCooldown.findUnique({ where: { userId } });

  if (row) {
    const diffMs = now.getTime() - new Date(row.lastStart).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < STARTCALL_COOLDOWN_SECONDS) {
      return { ok: false, remaining: STARTCALL_COOLDOWN_SECONDS - diffSec };
    }
    await prisma.phoneGuyCooldown.update({
      where: { userId },
      data: { lastStart: now },
    });
    return { ok: true, remaining: 0 };
  }

  await prisma.phoneGuyCooldown.create({
    data: { userId, lastStart: now },
  });
  return { ok: true, remaining: 0 };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("phone")
    .setDescription(
      "Phone Guy — get paired with someone to chat (local or global)"
    )
    .addSubcommand((sc) =>
      sc
        .setName("set")
        .setDescription("Set this server's phone lobby channel (optional)")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Lobby channel").setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName("setlog")
        .setDescription("Set the Phone Guy safety log channel (recommended)")
        .addChannelOption((o) =>
          o.setName("channel").setDescription("Log channel").setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName("optin")
        .setDescription("Opt-in to receive Phone Guy calls in this server")
    )
    .addSubcommand((sc) =>
      sc
        .setName("optout")
        .setDescription("Opt-out of Phone Guy calls in this server")
    )
    .addSubcommand((sc) =>
      sc
        .setName("block")
        .setDescription("Block someone from matching with you (global/local)")
        .addUserOption((o) =>
          o.setName("user").setDescription("User to block").setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName("unblock")
        .setDescription("Remove a block")
        .addUserOption((o) =>
          o.setName("user").setDescription("User to unblock").setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName("startcall")
        .setDescription("Start a call (local server or global cross-server)")
        .addStringOption((o) =>
          o
            .setName("mode")
            .setDescription(
              "local = someone in this server, global = someone in any server"
            )
            .setRequired(true)
            .addChoices(
              { name: "local", value: "local" },
              { name: "global", value: "global" }
            )
        )
    )
    .addSubcommand((sc) =>
      sc.setName("endcall").setDescription("Hang up the current call")
    )
    .addSubcommand((sc) =>
      sc
        .setName("say")
        .setDescription("Send a message to the person you're connected to")
        .addStringOption((o) =>
          o
            .setName("message")
            .setDescription("What you want to say")
            .setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc.setName("status").setDescription("See your Phone Guy status")
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ ephemeral: true });

    // ---------- /phone set ----------
    if (sub === "set") {
      const channel = interaction.options.getChannel("channel", true);

      await prisma.phoneGuyConfig.upsert({
        where: { guildId: interaction.guild.id },
        update: { channelId: channel.id },
        create: { guildId: interaction.guild.id, channelId: channel.id },
      });

      await interaction.editReply(`✅ Phone lobby set to ${channel}`);
      return;
    }

    // ---------- /phone setlog ----------
    if (sub === "setlog") {
      const channel = interaction.options.getChannel("channel", true);

      await prisma.phoneGuyConfig.upsert({
        where: { guildId: interaction.guild.id },
        update: { logChannelId: channel.id },
        create: { guildId: interaction.guild.id, logChannelId: channel.id },
      });

      await interaction.editReply(
        `✅ Phone Guy logs will be posted in ${channel}`
      );
      return;
    }

    // ---------- /phone optin ----------
    if (sub === "optin") {
      await prisma.phoneGuyOptIn.upsert({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
        },
        update: {},
        create: { guildId: interaction.guild.id, userId: interaction.user.id },
      });

      await interaction.editReply(
        "✅ You’re opted in for Phone Guy calls in this server."
      );
      return;
    }

    // ---------- /phone optout ----------
    if (sub === "optout") {
      await prisma.phoneGuyOptIn
        .delete({
          where: {
            guildId_userId: {
              guildId: interaction.guild.id,
              userId: interaction.user.id,
            },
          },
        })
        .catch(() => {});

      await interaction.editReply(
        "✅ You’re opted out for Phone Guy calls in this server."
      );
      return;
    }

    // ---------- /phone block ----------
    if (sub === "block") {
      const user = interaction.options.getUser("user", true);
      if (user.id === interaction.user.id) {
        await interaction.editReply("ℹ️ You can’t block yourself.");
        return;
      }

      await prisma.phoneGuyBlock.upsert({
        where: {
          blockerId_blockedId: {
            blockerId: interaction.user.id,
            blockedId: user.id,
          },
        },
        update: {},
        create: { blockerId: interaction.user.id, blockedId: user.id },
      });

      await interaction.editReply(
        `✅ Blocked <@${user.id}> from matching with you.`
      );
      return;
    }

    // ---------- /phone unblock ----------
    if (sub === "unblock") {
      const user = interaction.options.getUser("user", true);

      await prisma.phoneGuyBlock
        .delete({
          where: {
            blockerId_blockedId: {
              blockerId: interaction.user.id,
              blockedId: user.id,
            },
          },
        })
        .catch(() => {});

      await interaction.editReply(`✅ Unblocked <@${user.id}>.`);
      return;
    }

    // ---------- /phone status ----------
    if (sub === "status") {
      const opted = await prisma.phoneGuyOptIn.findUnique({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
        },
      });

      const call = await getActiveCallForUser(interaction.user.id);

      const waiting = await prisma.phoneGuyQueue.findFirst({
        where: { userId: interaction.user.id, mode: "global" },
      });

      await interaction.editReply(
        [
          `📞 Opted-in (this server): **${opted ? "yes" : "no"}**`,
          `⏳ Waiting (global queue): **${waiting ? "yes" : "no"}**`,
          `☎️ In call: **${call ? "yes" : "no"}**`,
          `🧊 Startcall cooldown: **${STARTCALL_COOLDOWN_SECONDS}s**`,
        ].join("\n")
      );
      return;
    }

    // ---------- /phone endcall ----------
    if (sub === "endcall") {
      const call = await getActiveCallForUser(interaction.user.id);
      if (!call) {
        await interaction.editReply("ℹ️ You’re not in a call.");
        return;
      }

      const { otherUserId, otherGuildId } = otherParty(
        call,
        interaction.user.id
      );

      await prisma.phoneGuyCall.update({
        where: { id: call.id },
        data: { status: "ended", endedAt: new Date() },
      });

      await safeDm(
        interaction.client,
        otherUserId,
        "📴 The other person ended the call."
      );

      await logEvent({
        type: "end",
        mode: call.mode,
        callId: call.id,
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        otherUserId,
      });

      await postToLogChannel(
        interaction.client,
        interaction.guild.id,
        `📴 **PhoneGuy end** • <@${interaction.user.id}> ended call \`${call.id}\``
      );
      // Log also to the other guild if global
      if (otherGuildId && otherGuildId !== interaction.guild.id) {
        await postToLogChannel(
          interaction.client,
          otherGuildId,
          `📴 **PhoneGuy end** • <@${interaction.user.id}> ended call \`${call.id}\``
        );
      }

      await interaction.editReply("✅ Call ended.");
      return;
    }

    // ---------- /phone say ----------
    if (sub === "say") {
      const call = await getActiveCallForUser(interaction.user.id);
      if (!call) {
        await interaction.editReply(
          "ℹ️ You’re not in a call. Use `/phone startcall` first."
        );
        return;
      }

      const msg = interaction.options.getString("message", true);
      const { otherUserId, otherGuildId } = otherParty(
        call,
        interaction.user.id
      );

      // Optional: prevent sending if blocked mid-call
      if (await isBlockedEitherWay(interaction.user.id, otherUserId)) {
        await interaction.editReply(
          "⛔ Message not sent because one of you has blocked the other."
        );
        return;
      }

      const delivered = await safeDm(
        interaction.client,
        otherUserId,
        `📞 **Phone Guy** (${interaction.user.username}):\n${msg}`
      );

      await logEvent({
        type: "say",
        mode: call.mode,
        callId: call.id,
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        otherUserId,
        message: msg.slice(0, 500),
      });

      // Safety log: we log metadata (and truncated message) to server log channel
      const logLine = `💬 **PhoneGuy msg** • call \`${call.id}\` • <@${
        interaction.user.id
      }> → <@${otherUserId}> • ${
        delivered ? "delivered" : "dm_failed"
      }\n> ${msg.slice(0, 200)}`;
      await postToLogChannel(interaction.client, interaction.guild.id, logLine);
      if (otherGuildId && otherGuildId !== interaction.guild.id) {
        await postToLogChannel(interaction.client, otherGuildId, logLine);
      }

      await interaction.editReply(
        delivered
          ? "✅ Sent."
          : "⚠️ Couldn’t DM them (they may have DMs off). Ask them to enable DMs and try again."
      );
      return;
    }

    // ---------- /phone startcall ----------
    if (sub === "startcall") {
      const mode = interaction.options.getString("mode", true);

      // Cooldown
      const cd = await checkAndSetCooldown(interaction.user.id);
      if (!cd.ok) {
        await interaction.editReply(
          `🧊 Slow down — try again in **${cd.remaining}s**.`
        );
        return;
      }

      // Already in a call?
      const existing = await getActiveCallForUser(interaction.user.id);
      if (existing) {
        await interaction.editReply(
          "⛔ You’re already in a call. Use `/phone endcall` first."
        );
        return;
      }

      // Must be opted-in in THIS server
      const opted = await prisma.phoneGuyOptIn.findUnique({
        where: {
          guildId_userId: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          },
        },
      });
      if (!opted) {
        await interaction.editReply(
          "⛔ You must `/phone optin` first (consent)."
        );
        return;
      }

      // -------- Local: random opted-in user in this guild
      if (mode === "local") {
        const pool = await prisma.phoneGuyOptIn.findMany({
          where: {
            guildId: interaction.guild.id,
            NOT: { userId: interaction.user.id },
          },
          take: 100,
        });

        if (pool.length === 0) {
          await interaction.editReply("ℹ️ No one else is opted-in right now.");
          return;
        }

        // Try a few random picks, skipping blocked users and users not in guild
        let target = null;
        for (let i = 0; i < 15; i++) {
          const pick = pool[Math.floor(Math.random() * pool.length)];
          const member = await interaction.guild.members
            .fetch(pick.userId)
            .catch(() => null);
          if (!member || member.user.bot) continue;
          if (await isBlockedEitherWay(interaction.user.id, pick.userId))
            continue;
          target = pick.userId;
          break;
        }

        if (!target) {
          await interaction.editReply(
            "ℹ️ Couldn’t find an available opted-in member (blocks may be limiting matches)."
          );
          return;
        }

        const call = await prisma.phoneGuyCall.create({
          data: {
            userAId: interaction.user.id,
            guildAId: interaction.guild.id,
            userBId: target,
            guildBId: interaction.guild.id,
            mode: "local",
          },
        });

        await logEvent({
          type: "match",
          mode: "local",
          callId: call.id,
          guildId: interaction.guild.id,
          userId: interaction.user.id,
          otherUserId: target,
        });

        await postToLogChannel(
          interaction.client,
          interaction.guild.id,
          `📞 **PhoneGuy match (local)** • call \`${call.id}\` • <@${interaction.user.id}> ↔ <@${target}>`
        );

        await safeDm(
          interaction.client,
          target,
          `📞 **Phone Guy (LOCAL)** — You’ve been connected!\nUse \`/phone say\` to chat and \`/phone endcall\` to hang up.`
        );

        await interaction.editReply("✅ Connected (local). Check your DMs.");
        return;
      }

      // -------- Global: queue + match someone else queued
      if (mode === "global") {
        // Ensure not already queued
        const alreadyQueued = await prisma.phoneGuyQueue.findFirst({
          where: { userId: interaction.user.id, mode: "global" },
        });
        if (alreadyQueued) {
          await interaction.editReply(
            "⏳ You’re already in the global queue. Use `/phone status`."
          );
          return;
        }

        await logEvent({
          type: "queue_join",
          mode: "global",
          guildId: interaction.guild.id,
          userId: interaction.user.id,
        });

        // Put in queue, then try to match
        const result = await prisma.$transaction(async (tx) => {
          await tx.phoneGuyQueue.create({
            data: {
              userId: interaction.user.id,
              guildId: interaction.guild.id,
              mode: "global",
            },
          });

          // Find earliest other queued user NOT blocked either way
          const candidates = await tx.phoneGuyQueue.findMany({
            where: { mode: "global", NOT: { userId: interaction.user.id } },
            orderBy: { createdAt: "asc" },
            take: 25,
          });

          let other = null;
          for (const c of candidates) {
            // NOTE: can't call isBlockedEitherWay (non-tx). Use tx directly:
            const blocked = await tx.phoneGuyBlock.findFirst({
              where: {
                OR: [
                  { blockerId: interaction.user.id, blockedId: c.userId },
                  { blockerId: c.userId, blockedId: interaction.user.id },
                ],
              },
            });
            if (!blocked) {
              other = c;
              break;
            }
          }

          if (!other) return { matched: false };

          // remove other
          await tx.phoneGuyQueue.delete({ where: { id: other.id } });

          // remove me (most recent)
          const me = await tx.phoneGuyQueue.findFirst({
            where: { userId: interaction.user.id, mode: "global" },
            orderBy: { createdAt: "desc" },
          });
          if (me) await tx.phoneGuyQueue.delete({ where: { id: me.id } });

          const call = await tx.phoneGuyCall.create({
            data: {
              userAId: interaction.user.id,
              guildAId: interaction.guild.id,
              userBId: other.userId,
              guildBId: other.guildId,
              mode: "global",
            },
          });

          return {
            matched: true,
            call,
            otherUserId: other.userId,
            otherGuildId: other.guildId,
          };
        });

        if (!result.matched) {
          await interaction.editReply(
            "⏳ Added to the global queue. Waiting for someone else to call…"
          );
          return;
        }

        await logEvent({
          type: "match",
          mode: "global",
          callId: result.call.id,
          guildId: interaction.guild.id,
          userId: interaction.user.id,
          otherUserId: result.otherUserId,
        });

        // Safety logs to both guilds (if configured)
        const matchLine = `📞 **PhoneGuy match (global)** • call \`${result.call.id}\` • <@${interaction.user.id}> ↔ <@${result.otherUserId}>`;
        await postToLogChannel(
          interaction.client,
          interaction.guild.id,
          matchLine
        );
        if (
          result.otherGuildId &&
          result.otherGuildId !== interaction.guild.id
        ) {
          await postToLogChannel(
            interaction.client,
            result.otherGuildId,
            matchLine
          );
        }

        await safeDm(
          interaction.client,
          result.otherUserId,
          `📞 **Phone Guy (GLOBAL)** — You’ve been connected!\nUse \`/phone say\` to chat and \`/phone endcall\` to hang up.`
        );

        await interaction.editReply("✅ Connected (global). Check your DMs.");
        return;
      }
    }

    await interaction.editReply("Unknown subcommand.");
  },
};
