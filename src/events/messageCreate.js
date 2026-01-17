const { Events } = require("discord.js");

// Import the raw modules (whatever they export)
const countingModule = require("../modules/games/counting/handler");
const lastLetterModule = require("../modules/games/lastletter/handler");

// Leveling is the one we know is exporting a named function
const { handleLevelingMessage } = require("../modules/leveling/handler");

/**
 * Try to resolve a handler function from a module by checking several
 * common property names. This avoids "is not a function" crashes if
 * the module's export shape isn't exactly what we expect.
 */
function resolveHandler(mod, label, candidates) {
  if (!mod) {
    console.warn(`[messageCreate:${label}] module is undefined/null`);
    return null;
  }

  // Case 1: module itself is a function: module.exports = async (msg) => { ... }
  if (typeof mod === "function") {
    console.log(`[messageCreate:${label}] using default export function`);
    return mod;
  }

  // Case 2: module is an object with one of several candidate methods
  for (const name of candidates) {
    if (mod && typeof mod[name] === "function") {
      console.log(`[messageCreate:${label}] using mod.${name}()`);
      return mod[name].bind(mod);
    }
  }

  console.warn(
    `[messageCreate:${label}] no handler function found on module; candidates: ${candidates.join(
      ", "
    )}`
  );
  return null;
}

// Try to lock onto whatever your counting handler actually exported
const countingHandler = resolveHandler(countingModule, "counting", [
  "handleCountingMessage", // our preferred name
  "handleCounting",
  "handleMessage",
  "run",
  "execute",
]);

// Try to lock onto whatever your last-letter handler exported
const lastLetterHandler = resolveHandler(lastLetterModule, "lastletter", [
  "handleLastLetterMessage", // our preferred name
  "handleLastLetter",
  "handleMessage",
  "run",
  "execute",
]);

module.exports = {
  name: Events.MessageCreate,

  /**
   * Main messageCreate dispatcher.
   * - Runs leveling on all normal guild messages
   * - Forwards messages to counting & last-letter handlers
   *   (they decide whether to act based on channel/config)
   */
  async execute(message) {
    try {
      // Ignore DMs & bot messages
      if (!message.guild || message.author.bot) return;

      // 1) Leveling (safe-guarded)
      try {
        await handleLevelingMessage(message);
      } catch (err) {
        console.error("[messageCreate:leveling] error:", err);
      }

      // 2) Counting game (only if we actually found a handler)
      if (countingHandler) {
        try {
          await countingHandler(message);
        } catch (err) {
          console.error("[messageCreate:counting] error:", err);
        }
      }

      // 3) Last-letter game (only if we actually found a handler)
      if (lastLetterHandler) {
        try {
          await lastLetterHandler(message);
        } catch (err) {
          console.error("[messageCreate:lastletter] error:", err);
        }
      }
    } catch (err) {
      console.error("[messageCreate] fatal error:", err);
    }
  },
};
