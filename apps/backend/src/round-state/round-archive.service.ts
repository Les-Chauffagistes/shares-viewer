import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../database/prisma.service";
import { LevelService } from "./level.service";
import { ArchivedRoundSnapshotForDb } from "../shares/types/archive-db.types";

type TxClient = Prisma.TransactionClient;

export type ArchiveRoundResult = {
  roundArchiveId: number;
  levelUpdates: Array<{
    rawAddress: string;
    addressId: string;
    workerName: string;
    level: number;
  }>;
} | null;

@Injectable()
export class RoundArchiveService {
  private readonly logger = new Logger(RoundArchiveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly levelService: LevelService,
  ) {}

  async archiveRound(
    snapshot: ArchivedRoundSnapshotForDb,
  ): Promise<ArchiveRoundResult> {
    if (!snapshot.workers.length) {
      this.logger.warn(`Round ${snapshot.roundKey} ignoré: aucun worker`);
      return null;
    }

    const bestShare = Math.max(...snapshot.workers.map((w) => w.bestShare), 0);
    const sharesCount = snapshot.workers.reduce(
      (acc, w) => acc + w.sharesCount,
      0,
    );

    const existingProfiles = await this.prisma.workerProfile.findMany({
      where: {
        OR: snapshot.workers.map((worker) => ({
          addressId: worker.addressId,
          workerName: worker.workerName,
        })),
      },
    });

    const existingProfilesMap = new Map(
      existingProfiles.map((profile) => [
        this.profileKey(profile.addressId, profile.workerName),
        profile,
      ]),
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
            startedAt: snapshot.startedAt
              ? new Date(snapshot.startedAt * 1000)
              : null,
            endedAt: new Date(snapshot.endedAt * 1000),
            workersCount: snapshot.workers.length,
            sharesCount,
            bestShare,
          },
        });

        const levelUpdates: Array<{
          rawAddress: string;
          addressId: string;
          workerName: string;
          level: number;
        }> = [];

        for (let i = 0; i < snapshot.workers.length; i += 1) {
          const worker = snapshot.workers[i];
          const rank = i + 1;

          await tx.workerAddress.upsert({
            where: { id: worker.addressId },
            update: {
              rawAddress: worker.rawAddress,
              isPublic: worker.isPublic,
              label: worker.addressLabel,
            },
            create: {
              id: worker.addressId,
              rawAddress: worker.rawAddress,
              isPublic: worker.isPublic,
              label: worker.addressLabel,
            },
          });

          const existingProfile = existingProfilesMap.get(
            this.profileKey(worker.addressId, worker.workerName),
          );

          const nextStreak = (existingProfile?.currentStreak ?? 0) + 1;
          const xpGained = this.levelService.computeXpGain({
            bestShare: worker.bestShare,
            sharesCount: worker.sharesCount,
            streak: nextStreak,
          });

          const totalXpAfter = (existingProfile?.xp ?? 0) + xpGained;
          const levelAfter = this.levelService.computeLevel(totalXpAfter);

          await tx.workerProfile.upsert({
            where: {
              addressId_workerName: {
                addressId: worker.addressId,
                workerName: worker.workerName,
              },
            },
            update: {
              worker: worker.worker,
              addressId: worker.addressId,
              bestShareEver: Math.max(
                existingProfile?.bestShareEver ?? 0,
                worker.bestShare,
              ),
              totalShares:
                (existingProfile?.totalShares ?? 0) + worker.sharesCount,
              roundsParticipated:
                (existingProfile?.roundsParticipated ?? 0) + 1,
              currentStreak: nextStreak,
              bestStreak: Math.max(
                existingProfile?.bestStreak ?? 0,
                nextStreak,
              ),
              xp: totalXpAfter,
              level: levelAfter,
            },
            create: {
              workerName: worker.workerName,
              worker: worker.worker,
              addressId: worker.addressId,
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
              roundKey_addressId_workerName: {
                roundKey: snapshot.roundKey,
                addressId: worker.addressId,
                workerName: worker.workerName,
              },
            },
            update: {
              roundArchiveId: roundArchive.id,
              addressId: worker.addressId,
              worker: worker.worker,
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
              worker: worker.worker,
              addressId: worker.addressId,
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

          levelUpdates.push({
            rawAddress: worker.rawAddress,
            addressId: worker.addressId,
            workerName: worker.workerName,
            level: levelAfter,
          });
        }

        await this.resetStreaksForAbsentWorkers(
          tx,
          snapshot.workers.map((worker) => ({
            addressId: worker.addressId,
            workerName: worker.workerName,
          })),
        );

        await this.keepOnlyLastFiveRounds(tx);

        return {
          roundArchiveId: roundArchive.id,
          levelUpdates,
        };
      },
      {
        timeout: 15000,
      },
    );
  }

  private profileKey(addressId: string, workerName: string): string {
    return `${addressId}::${workerName}`;
  }

  private async resetStreaksForAbsentWorkers(
    tx: TxClient,
    presentWorkers: Array<{ addressId: string; workerName: string }>,
  ) {
    if (!presentWorkers.length) {
      return;
    }

    const activeProfiles = await tx.workerProfile.findMany({
      where: {
        currentStreak: { gt: 0 },
      },
      select: {
        addressId: true,
        workerName: true,
      },
    });

    const presentKeys = new Set(
      presentWorkers.map((worker) =>
        this.profileKey(worker.addressId, worker.workerName),
      ),
    );

    const profilesToReset = activeProfiles.filter(
      (profile) =>
        !presentKeys.has(this.profileKey(profile.addressId, profile.workerName)),
    );

    if (!profilesToReset.length) {
      return;
    }

    await tx.workerProfile.updateMany({
      where: {
        OR: profilesToReset.map((profile) => ({
          addressId: profile.addressId,
          workerName: profile.workerName,
        })),
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

    if (rounds.length <= 5) {
      return;
    }

    const idsToDelete = rounds.slice(5).map((round) => round.id);

    await tx.workerRoundStat.deleteMany({
      where: { roundArchiveId: { in: idsToDelete } },
    });

    await tx.roundArchive.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }
}