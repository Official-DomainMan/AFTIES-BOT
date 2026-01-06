-- CreateTable
CREATE TABLE "CountingState" (
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "lastUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountingState_pkey" PRIMARY KEY ("guildId")
);
