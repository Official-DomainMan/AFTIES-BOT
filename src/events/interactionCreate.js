const { Events, MessageFlags } = require("discord.js");
const { handleTicketInteraction } = require("../modules/tickets/interaction");

const seenInteractions = new Map();
const SEEN_TTL_MS = 15_000;

function markSeen(interactionId) {
  seenInteractions.set(interactionId, Date.now());

  setTimeout(() => {
    const ts = seenInteractions.get(interactionId);
    if (ts && Date.now() - ts >= SEEN_TTL_MS) {
      seenInteractions.delete(interactionId);
    }
  }, SEEN_TTL_MS + 1000);
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const tag = `[interactionCreate pid=${process.pid} id=${interaction.id}]`;

    if (seenInteractions.has(interaction.id)) {
      console.warn(`${tag} Duplicate interaction ignored in same process.`);
      return;
    }

    markSeen(interaction.id);

    try {
      if (
        (interaction.isButton() || interaction.isModalSubmit()) &&
        typeof interaction.customId === "string" &&
        interaction.customId.startsWith("ticket_")
      ) {
        console.log(
          `${tag} Handling ticket component: ${interaction.customId}`,
        );
        await handleTicketInteraction(interaction);
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      console.log(
        `${tag} Slash command received: /${interaction.commandName} | deferred=${interaction.deferred} replied=${interaction.replied}`,
      );

      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.warn(
          `${tag} No command registered for "${interaction.commandName}"`,
        );
        return;
      }

      // Acknowledge immediately here for slash commands.
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        console.log(`${tag} deferred in interactionCreate`);
      }

      await command.execute(interaction);

      console.log(
        `${tag} Command finished: /${interaction.commandName} | deferred=${interaction.deferred} replied=${interaction.replied}`,
      );
    } catch (err) {
      console.error(
        `${tag} ERROR in ${interaction.commandName ?? "unknown"}:`,
        err,
      );

      try {
        if (!interaction.isRepliable()) return;

        if (interaction.deferred || interaction.replied) {
          await interaction
            .editReply({
              content: "❌ Something went wrong while running that command.",
            })
            .catch(() => null);
        } else {
          await interaction
            .reply({
              content: "❌ Something went wrong while running that command.",
              flags: MessageFlags.Ephemeral,
            })
            .catch(() => null);
        }
      } catch (replyErr) {
        console.error(`${tag} Failed sending error reply:`, replyErr);
      }
    }
  },
};
