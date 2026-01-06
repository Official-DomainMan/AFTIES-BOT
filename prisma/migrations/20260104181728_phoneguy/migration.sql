-- CreateTable
CREATE TABLE "PhoneGuyConfig" (
    "guildId" TEXT NOT NULL,
    "channelId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneGuyConfig_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "PhoneGuyOptIn" (
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneGuyOptIn_pkey" PRIMARY KEY ("guildId","userId")
);

-- CreateTable
CREATE TABLE "PhoneGuyQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneGuyQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneGuyCall" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "guildAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "guildBId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PhoneGuyCall_pkey" PRIMARY KEY ("id")
);
