-- CreateTable
CREATE TABLE "CountingUserStat" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lastCount" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountingUserStat_pkey" PRIMARY KEY ("guildId","userId")
);
