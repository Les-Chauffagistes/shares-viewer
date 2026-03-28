/*
  Warnings:

  - A unique constraint covering the columns `[addressId,worker]` on the table `WorkerProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_addressId_worker_key" ON "WorkerProfile"("addressId", "worker");
