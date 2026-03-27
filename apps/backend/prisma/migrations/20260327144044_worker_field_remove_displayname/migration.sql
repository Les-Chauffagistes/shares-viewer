/*
  Warnings:

  - You are about to drop the column `displayName` on the `WorkerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `displayName` on the `WorkerRoundStat` table. All the data in the column will be lost.
  - Added the required column `worker` to the `WorkerProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `worker` to the `WorkerRoundStat` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "WorkerProfile" DROP COLUMN "displayName",
ADD COLUMN     "worker" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkerRoundStat" DROP COLUMN "displayName",
ADD COLUMN     "worker" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "WorkerProfile_worker_idx" ON "WorkerProfile"("worker");

-- CreateIndex
CREATE INDEX "WorkerRoundStat_worker_idx" ON "WorkerRoundStat"("worker");
