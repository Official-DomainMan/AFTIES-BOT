// src/events/messageReactionAdd.js
const { handleReactionAdd } = require("../modules/leveling/reactions");

module.exports = {
  name: "messageReactionAdd",
  async execute(reaction, user) {
    try {
      await handleReactionAdd(reaction, user);
    } catch (err) {
      console.error("[events/messageReactionAdd] error:", err);
    }
  },
};
