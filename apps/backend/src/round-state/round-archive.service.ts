import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { LevelService } from "./level.service";
import { ArchivedRoundSnapshot } from "@shares-viewer/types";

type TxClient = Prisma.TransactionClient;

@Injectable()
export class RoundArchiveService {
  private readonly logger = new Logger(RoundArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly levelService: LevelService,
  ) {}

  async archiveRound(snapshot: ArchivedRoundSnapshot) {
    if (!snapshot.workers.length) {
      this.logger.warn(`Round ${snapshot.roundKey} ignoré: aucun worker`);
      return null;
    }

    const bestShare = Math.max(...snapshot.workers.map((w) => w.bestShare), 0);
    const sharesCount = snapshot.workers.reduce((acc, w) => acc + w.sharesCount, 0);
    const workerNames = snapshot.workers.map((w) => w.workerName);

    const existingProfiles = await this.prisma.workerProfile.findMany({
      where: {
        workerName: { in: workerNames },
      },
    });

    const existingProfilesMap = new Map(
      existingProfiles.map((profile) => [profile.workerName, profile]),
    );

    return this.prisma.$transaction(
      async (tx) => {
        const roundArchive = await tx.roundArchive.upsert({
          where: { roundKey: snapshot.roundKey },
          update: {
            endedAt: new Date(snapshot.endedAt * 1000),
            workersCount: snapshot.workers.length,
            sharesCount,
            bestShare,
          },
          create: {
            roundKey: snapshot.roundKey,
            startedAt: snapshot.startedAt ? new Date(snapshot.startedAt * 1000) : null,
            endedAt: new Date(snapshot.endedAt * 1000),
            workersCount: snapshot.workers.length,
            sharesCount,
            bestShare,
          },
        });

        for (let i = 0; i < snapshot.workers.length; i += 1) {
          const worker = snapshot.workers[i];
          const rank = i + 1;

          const existingProfile = existingProfilesMap.get(worker.workerName);

          const nextStreak = (existingProfile?.currentStreak ?? 0) + 1;
          const xpGained = this.levelService.computeXpGain({
            bestShare: worker.bestShare,
            sharesCount: worker.sharesCount,
            streak: nextStreak,
          });

          const totalXpAfter = (existingProfile?.xp ?? 0) + xpGained;
          const levelAfter = this.levelService.computeLevel(totalXpAfter);

          await tx.workerProfile.upsert({
            where: { workerName: worker.workerName },
            update: {
              address: worker.address,
              displayName: worker.displayName,
              bestShareEver: Math.max(existingProfile?.bestShareEver ?? 0, worker.bestShare),
              totalShares: (existingProfile?.totalShares ?? 0) + worker.sharesCount,
              roundsParticipated: (existingProfile?.roundsParticipated ?? 0) + 1,
              currentStreak: nextStreak,
              bestStreak: Math.max(existingProfile?.bestStreak ?? 0, nextStreak),
              xp: totalXpAfter,
              level: levelAfter,
            },
            create: {
              workerName: worker.workerName,
              address: worker.address,
              displayName: worker.displayName,
              bestShareEver: worker.bestShare,
              totalShares: worker.sharesCount,
              roundsParticipated: 1,
              currentStreak: 1,
              bestStreak: 1,
              xp: xpGained,
              level: levelAfter,
            },
          });

          await tx.workerRoundStat.upsert({
            where: {
              roundKey_workerName: {
                roundKey: snapshot.roundKey,
                workerName: worker.workerName,
              },
            },
            update: {
              roundArchiveId: roundArchive.id,
              address: worker.address,
              displayName: worker.displayName,
              bestShare: worker.bestShare,
              sharesCount: worker.sharesCount,
              rank,
              participated: true,
              streakAtTime: nextStreak,
              xpGained,
              totalXpAfter,
              levelAfter,
            },
            create: {
              roundArchiveId: roundArchive.id,
              roundKey: snapshot.roundKey,
              workerName: worker.workerName,
              address: worker.address,
              displayName: worker.displayName,
              bestShare: worker.bestShare,
              sharesCount: worker.sharesCount,
              rank,
              participated: true,
              streakAtTime: nextStreak,
              xpGained,
              totalXpAfter,
              levelAfter,
            },
          });
        }

        await this.resetStreaksForAbsentWorkers(
          tx,
          snapshot.workers.map((w) => w.workerName),
        );

        await this.keepOnlyLastFiveRounds(tx);

        return roundArchive;
      },
      {
        timeout: 15000,
      },
    );
  }

  private async resetStreaksForAbsentWorkers(
    tx: TxClient,
    presentWorkerNames: string[],
  ) {
    if (!presentWorkerNames.length) {
      return;
    }

    await tx.workerProfile.updateMany({
      where: {
        workerName: { notIn: presentWorkerNames },
        currentStreak: { gt: 0 },
      },
      data: {
        currentStreak: 0,
      },
    });
  }

  private async keepOnlyLastFiveRounds(tx: TxClient) {
    const rounds = await tx.roundArchive.findMany({
      orderBy: { endedAt: "desc" },
      select: { id: true },
    });

    if (rounds.length <= 5) return;

    const idsToDelete = rounds.slice(5).map((r) => r.id);

    await tx.workerRoundStat.deleteMany({
      where: { roundArchiveId: { in: idsToDelete } },
    });

    await tx.roundArchive.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }
}