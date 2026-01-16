// src/modules/leveling/reactions.js
const { awardXpForUser } = require("./handler");
const { applyLevelRewards } = require("./rewards");

async function handleReactionAdd(reaction, user) {
  try {
    if (user.bot) return;

    const message = reaction.message;
    if (!message.guild) return;

    const guild = message.guild;
    const guildId = guild.id;
    const userId = user.id;

    const { leveledUp, profile } = await awardXpForUser(guildId, userId, {
      minXp: 2,
      maxXp: 4,
    });

    if (leveledUp) {
      await applyLevelRewards(guild, userId, profile.level);
      // Optional: you could also announce here, but it might be spammy via reactions
    }
  } catch (err) {
    console.error("[leveling] handleReactionAdd error:", err);
  }
}

module.exports = { handleReactionAdd };
