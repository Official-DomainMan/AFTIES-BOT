// src/modules/games/lastletter/commands/lastletter-set.js
const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");

// From commands -> lastletter -> games -> modules -> src -> core
const { prisma } = require("../../../../core/database");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("lastletter-set")
    .setDescription("Set the channel used for the Last Letter word game.")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Text channel where the game will be played.")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel");
    const guildId = interaction.guild.id;

    let deferred = false;
    try {
      // Acknowledge quickly so Discord doesn't expire the interaction
      await interaction.deferReply({ ephemeral: true });
      deferred = true;
    } catch (err) {
      console.error("[lastletter-set] deferReply failed:", err);
      // We'll still try to continue; reply/edit might 10062 if this failed
    }

    try {
      const state = await prisma.lastLetterState.upsert({
        where: { guildId },
        update: {
          channelId: channel.id,
          lastWord: "",
          lastLetter: null,
          usedWords: { set: [] },
          currentStreak: 0,
          // NOTE: we intentionally do NOT touch bestStreak here
        },
        create: {
          guildId,
          channelId: channel.id,
          lastWord: "",
          lastLetter: null,
          usedWords: [],
          currentStreak: 0,
          bestStreak: 0,
        },
      });

      console.log("[lastletter-set] upserted state:", state);

      const content = `✅ Last Letter channel set to ${channel}. The game has been **reset** here.`;

      if (deferred) {
        await interaction.editReply({ content }).catch((err) => {
          console.error("[lastletter-set] editReply failed:", err);
        });
      } else if (!interaction.replied) {
        await interaction
          .reply({ content, ephemeral: true })
          .catch((err) => console.error("[lastletter-set] reply failed:", err));
      }
    } catch (err) {
      console.error("[lastletter-set] error during handler:", err);

      const errorText =
        "❌ Something went wrong saving the Last Letter setup. Check bot logs / DB config.";

      try {
        if (deferred) {
          await interaction.editReply({ content: errorText });
        } else if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: errorText, ephemeral: true });
        }
      } catch (replyErr) {
        console.error(
          "[lastletter-set] Failed to send error response:",
          replyErr
        );
      }
    }
  },
};
