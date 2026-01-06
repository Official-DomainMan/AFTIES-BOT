-- CreateTable
CREATE TABLE "PhoneGuyBlock" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneGuyBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateTable
CREATE TABLE "PhoneGuyCooldown" (
    "userId" TEXT NOT NULL,
    "lastStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhoneGuyCooldown_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PhoneGuyLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "mode" TEXT,
    "callId" TEXT,
    "guildId" TEXT,
    "userId" TEXT,
    "otherUserId" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneGuyLog_pkey" PRIMARY KEY ("id")
);
