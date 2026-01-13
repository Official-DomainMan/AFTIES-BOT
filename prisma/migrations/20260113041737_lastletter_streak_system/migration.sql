/*
  Warnings:

  - Made the column `lastWord` on table `LastLetterState` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "LastLetterState" ADD COLUMN     "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentStreak" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "lastWord" SET NOT NULL,
ALTER COLUMN "usedWords" DROP DEFAULT;
