-- AlterTable
ALTER TABLE "ModPolicy" ADD COLUMN     "dmOnAutoTimeout" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dmOnWarn" BOOLEAN NOT NULL DEFAULT false;
