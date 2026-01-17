const { Events } = require("discord.js");

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    // Only handle slash commands
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
      console.warn(
        `[interactionCreate] No command registered for "${interaction.commandName}"`
      );
      return;
    }

    try {
      // 🚨 IMPORTANT:
      // Do NOT reply or defer here.
      // Each command file (help, levels, levelroles, etc.) is fully responsible
      // for calling interaction.reply / interaction.deferReply / editReply.
      await command.execute(interaction);
    } catch (err) {
      console.error(`[interactionCreate:${interaction.commandName}]`, err);
      // NO reply here. Just log.
    }
  },
};
