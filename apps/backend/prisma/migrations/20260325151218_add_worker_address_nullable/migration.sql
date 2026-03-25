-- AlterTable
ALTER TABLE "WorkerProfile" ADD COLUMN     "address" TEXT;

-- AlterTable
ALTER TABLE "WorkerRoundStat" ADD COLUMN     "address" TEXT;

-- CreateIndex
CREATE INDEX "WorkerProfile_address_idx" ON "WorkerProfile"("address");

-- CreateIndex
CREATE INDEX "WorkerRoundStat_address_idx" ON "WorkerRoundStat"("address");
