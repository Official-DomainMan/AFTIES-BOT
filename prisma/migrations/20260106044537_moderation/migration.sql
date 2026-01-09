-- CreateTable
CREATE TABLE "ModConfig" (
    "guildId" TEXT NOT NULL,
    "logChannelId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModConfig_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "Infraction" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "reason" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Infraction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Infraction_guildId_userId_createdAt_idx" ON "Infraction"("guildId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "Infraction_guildId_createdAt_idx" ON "Infraction"("guildId", "createdAt");
