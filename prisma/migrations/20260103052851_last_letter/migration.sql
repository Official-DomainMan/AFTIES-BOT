-- CreateTable
CREATE TABLE "LastLetterState" (
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "lastWord" TEXT,
    "lastLetter" TEXT,
    "usedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LastLetterState_pkey" PRIMARY KEY ("guildId")
);
