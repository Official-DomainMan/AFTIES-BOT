-- CreateTable
CREATE TABLE "LevelRoleReward" (
    "guildId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "LevelRoleReward_pkey" PRIMARY KEY ("guildId","level")
);
