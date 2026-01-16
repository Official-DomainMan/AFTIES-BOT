-- CreateTable
CREATE TABLE "LevelProfile" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 0,
    "lastXpAt" TIMESTAMP(3),

    CONSTRAINT "LevelProfile_pkey" PRIMARY KEY ("guildId","userId")
);

-- CreateIndex
CREATE INDEX "LevelProfile_guildId_xp_idx" ON "LevelProfile"("guildId", "xp" DESC);
