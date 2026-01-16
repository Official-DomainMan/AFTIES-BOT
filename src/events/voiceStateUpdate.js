// src/events/voiceStateUpdate.js
const { handleVoiceStateUpdate } = require("../modules/leveling/voice");

module.exports = {
  name: "voiceStateUpdate",
  async execute(oldState, newState) {
    try {
      await handleVoiceStateUpdate(oldState, newState);
    } catch (err) {
      console.error("[events/voiceStateUpdate] error:", err);
    }
  },
};
