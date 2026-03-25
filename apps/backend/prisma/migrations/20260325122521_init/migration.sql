-- CreateTable
CREATE TABLE "RoundArchive" (
    "id" SERIAL NOT NULL,
    "roundKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3) NOT NULL,
    "workersCount" INTEGER NOT NULL,
    "sharesCount" INTEGER NOT NULL,
    "bestShare" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundArchive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRoundStat" (
    "id" SERIAL NOT NULL,
    "roundArchiveId" INTEGER NOT NULL,
    "roundKey" TEXT NOT NULL,
    "workerName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bestShare" DOUBLE PRECISION NOT NULL,
    "sharesCount" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "participated" BOOLEAN NOT NULL,
    "streakAtTime" INTEGER NOT NULL,
    "xpGained" DOUBLE PRECISION NOT NULL,
    "totalXpAfter" DOUBLE PRECISION NOT NULL,
    "levelAfter" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerRoundStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "id" SERIAL NOT NULL,
    "workerName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bestShareEver" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalShares" INTEGER NOT NULL DEFAULT 0,
    "roundsParticipated" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "xp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoundArchive_roundKey_key" ON "RoundArchive"("roundKey");

-- CreateIndex
CREATE INDEX "RoundArchive_endedAt_idx" ON "RoundArchive"("endedAt");

-- CreateIndex
CREATE INDEX "WorkerRoundStat_roundKey_idx" ON "WorkerRoundStat"("roundKey");

-- CreateIndex
CREATE INDEX "WorkerRoundStat_workerName_idx" ON "WorkerRoundStat"("workerName");

-- CreateIndex
CREATE INDEX "WorkerRoundStat_rank_idx" ON "WorkerRoundStat"("rank");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerRoundStat_roundKey_workerName_key" ON "WorkerRoundStat"("roundKey", "workerName");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_workerName_key" ON "WorkerProfile"("workerName");

-- CreateIndex
CREATE INDEX "WorkerProfile_level_idx" ON "WorkerProfile"("level");

-- CreateIndex
CREATE INDEX "WorkerProfile_bestShareEver_idx" ON "WorkerProfile"("bestShareEver");

-- AddForeignKey
ALTER TABLE "WorkerRoundStat" ADD CONSTRAINT "WorkerRoundStat_roundArchiveId_fkey" FOREIGN KEY ("roundArchiveId") REFERENCES "RoundArchive"("id") ON DELETE CASCADE ON UPDATE CASCADE;
