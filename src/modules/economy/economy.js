// src/modules/economy/economy.js
const { prisma } = require("../../core/database");

// 💸 Daily config
const DAILY_AMOUNT = 500; // how much a daily gives
const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

/**
 * Get or create an EconomyProfile for this user in this guild.
 */
async function getOrCreateProfile(guildId, userId) {
  let profile = await prisma.economyProfile.findUnique({
    where: {
      guildId_userId: { guildId, userId },
    },
  });

  if (!profile) {
    profile = await prisma.economyProfile.create({
      data: {
        guildId,
        userId,
        balance: 0,
        lastDailyAt: null,
      },
    });
  }

  return profile;
}

/**
 * Add or remove balance (amount can be negative).
 * Returns the updated profile.
 */
async function addBalance(guildId, userId, amount) {
  const profile = await getOrCreateProfile(guildId, userId);

  const newBalance = profile.balance + amount;

  const updated = await prisma.economyProfile.update({
    where: {
      guildId_userId: { guildId, userId },
    },
    data: {
      balance: newBalance,
    },
  });

  return updated;
}

/**
 * Check how long until the next daily is available.
 * Returns { canClaim: boolean, remainingMs: number }
 */
function getDailyStatus(profile) {
  if (!profile.lastDailyAt) {
    return { canClaim: true, remainingMs: 0 };
  }

  const last = new Date(profile.lastDailyAt);
  const now = new Date();
  const diff = now.getTime() - last.getTime();

  if (diff >= DAILY_COOLDOWN_MS) {
    return { canClaim: true, remainingMs: 0 };
  }

  return { canClaim: false, remainingMs: DAILY_COOLDOWN_MS - diff };
}

/**
 * Claim daily reward. Handles cooldown & balance update.
 * Returns { success, amount, newBalance, remainingMs }
 */
async function claimDaily(guildId, userId) {
  const profile = await getOrCreateProfile(guildId, userId);
  const status = getDailyStatus(profile);

  if (!status.canClaim) {
    return {
      success: false,
      amount: 0,
      newBalance: profile.balance,
      remainingMs: status.remainingMs,
    };
  }

  const updated = await prisma.economyProfile.update({
    where: {
      guildId_userId: { guildId, userId },
    },
    data: {
      balance: profile.balance + DAILY_AMOUNT,
      lastDailyAt: new Date(),
    },
  });

  return {
    success: true,
    amount: DAILY_AMOUNT,
    newBalance: updated.balance,
    remainingMs: 0,
  };
}

module.exports = {
  DAILY_AMOUNT,
  DAILY_COOLDOWN_MS,
  getOrCreateProfile,
  addBalance,
  getDailyStatus,
  claimDaily,
};
