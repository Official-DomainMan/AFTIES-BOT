-- CreateTable
CREATE TABLE "TicketSettings" (
    "guildId" TEXT NOT NULL,
    "categoryId" TEXT,
    "supportRoleId" TEXT,
    "logChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketSettings_pkey" PRIMARY KEY ("guildId")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "claimedById" TEXT,
    "closeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");

-- CreateIndex
CREATE INDEX "Ticket_guildId_ownerId_idx" ON "Ticket"("guildId", "ownerId");

-- CreateIndex
CREATE INDEX "Ticket_guildId_isOpen_idx" ON "Ticket"("guildId", "isOpen");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_guildId_ownerId_isOpen_key" ON "Ticket"("guildId", "ownerId", "isOpen");
