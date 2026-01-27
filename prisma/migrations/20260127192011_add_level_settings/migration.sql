-- CreateTable
CREATE TABLE "LevelSettings" (
    "guildId" TEXT NOT NULL,
    "levelUpChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LevelSettings_pkey" PRIMARY KEY ("guildId")
);
