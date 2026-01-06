const { handleLastLetter } = require("../modules/games/lastletter/handler");
const { handleCounting } = require("../modules/games/counting/handler");

module.exports = {
  name: "messageCreate",
  async execute(message) {
    await handleLastLetter(message);
    await handleCounting(message);
  },
};
