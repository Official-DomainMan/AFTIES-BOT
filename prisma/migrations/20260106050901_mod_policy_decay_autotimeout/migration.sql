-- AlterTable
ALTER TABLE "Infraction" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ModPolicy" (
    "guildId" TEXT NOT NULL,
    "warnExpiresDays" INTEGER NOT NULL DEFAULT 30,
    "warnWindowDays" INTEGER NOT NULL DEFAULT 7,
    "autoTimeoutWarnCount" INTEGER NOT NULL DEFAULT 3,
    "autoTimeoutMinutes" INTEGER NOT NULL DEFAULT 60,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModPolicy_pkey" PRIMARY KEY ("guildId")
);
