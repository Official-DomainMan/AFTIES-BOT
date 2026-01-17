-- CreateTable
CREATE TABLE "LevelRole" (
    "guildId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "requiredLevel" INTEGER NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LevelRole_pkey" PRIMARY KEY ("guildId","roleId")
);
