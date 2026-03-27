/*
  Warnings:

  - You are about to drop the column `address` on the `WorkerProfile` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `WorkerRoundStat` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[addressId,workerName]` on the table `WorkerProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[roundKey,addressId,workerName]` on the table `WorkerRoundStat` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `addressId` to the `WorkerProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `addressId` to the `WorkerRoundStat` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "WorkerProfile_address_idx";

-- DropIndex
DROP INDEX "WorkerProfile_workerName_key";

-- DropIndex
DROP INDEX "WorkerRoundStat_address_idx";

-- DropIndex
DROP INDEX "WorkerRoundStat_roundKey_workerName_key";

-- AlterTable
ALTER TABLE "WorkerProfile" DROP COLUMN "address",
ADD COLUMN     "addressId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WorkerRoundStat" DROP COLUMN "address",
ADD COLUMN     "addressId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "WorkerAddress" (
    "id" TEXT NOT NULL,
    "rawAddress" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerAddress_rawAddress_key" ON "WorkerAddress"("rawAddress");

-- CreateIndex
CREATE INDEX "WorkerAddress_isPublic_idx" ON "WorkerAddress"("isPublic");

-- CreateIndex
CREATE INDEX "WorkerAddress_label_idx" ON "WorkerAddress"("label");

-- CreateIndex
CREATE INDEX "WorkerProfile_addressId_idx" ON "WorkerProfile"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_addressId_workerName_key" ON "WorkerProfile"("addressId", "workerName");

-- CreateIndex
CREATE INDEX "WorkerRoundStat_addressId_idx" ON "WorkerRoundStat"("addressId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerRoundStat_roundKey_addressId_workerName_key" ON "WorkerRoundStat"("roundKey", "addressId", "workerName");

-- AddForeignKey
ALTER TABLE "WorkerRoundStat" ADD CONSTRAINT "WorkerRoundStat_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "WorkerAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerProfile" ADD CONSTRAINT "WorkerProfile_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "WorkerAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
