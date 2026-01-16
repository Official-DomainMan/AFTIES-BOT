const { handleCounting } = require("../modules/games/counting/handler");
const { handleLastLetter } = require("../modules/games/lastletter/handler");
const { handleLevelingMessage } = require("../modules/leveling/handler");

// Make Phone Guy optional so a missing handler doesn't crash the bot
let handlePhoneGuyMessage = async () => {};

try {
  ({ handlePhoneGuyMessage } = require("../modules/games/phoneguy/handler"));
} catch (err) {
  console.warn(
    "[phoneguy] handler not found, skipping Phone Guy message handling."
  );
  handlePhoneGuyMessage = async () => {};
}

module.exports = {
  name: "messageCreate",
  async execute(message) {
    try {
      // Games
      await handleCounting(message);
      await handleLastLetter(message);
      await handlePhoneGuyMessage(message);

      // Leveling
      await handleLevelingMessage(message);
    } catch (err) {
      console.error("[messageCreate] handler error:", err);
    }
  },
};
