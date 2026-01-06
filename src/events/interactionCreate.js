module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const cmd = interaction.client.commands.get(interaction.commandName);
    if (!cmd) return;

    try {
      await cmd.execute(interaction);
    } catch (err) {
      console.error(err);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: "❌ Error running command",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "❌ Error running command",
          ephemeral: true,
        });
      }
    }
  },
};
