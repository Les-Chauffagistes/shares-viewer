import { Controller, Get } from "@nestjs/common";
import { SharesService } from "./shares/shares.service";
import { PrismaService } from "./database/prisma.service";

@Controller("/api")
export class AppController {
  constructor(
    private readonly sharesService: SharesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("/health")
  health() {
    return { ok: true };
  }

  @Get("/live")
  async live() {
    console.log("/api/live appelé");
    return this.sharesService.getLiveState();
  }

  @Get("/history")
  async history() {
    console.log("➡️ /api/history appelé");

    try {
      console.log("🔍 Lancement requête Prisma history...");

      const rounds = await this.prisma.roundArchive.findMany({
        orderBy: { endedAt: "desc" },
        take: 5,
        select: {
          id: true,
          roundKey: true,
          startedAt: true,
          endedAt: true,
          workersCount: true,
          sharesCount: true,
          bestShare: true,
          createdAt: true,
          workerStats: {
            orderBy: { rank: "asc" },
            select: {
              id: true,
              roundKey: true,
              worker: true,
              bestShare: true,
              sharesCount: true,
              rank: true,
              participated: true,
              streakAtTime: true,
              xpGained: true,
              totalXpAfter: true,
              levelAfter: true,
              createdAt: true,
              address: {
                select: {
                  id: true,
                  label: true,
                  isPublic: true,
                },
              },
            },
          },
        },
      });

      const result = rounds.map((round) => ({
        id: round.id,
        roundKey: round.roundKey,
        startedAt: round.startedAt,
        endedAt: round.endedAt,
        workersCount: round.workersCount,
        sharesCount: round.sharesCount,
        bestShare: round.bestShare,
        createdAt: round.createdAt,
        workerStats: round.workerStats.map((stat) => ({
          id: stat.id,
          roundKey: stat.roundKey,
          worker: stat.worker,
          address: stat.address.label,
          isPublic: stat.address.isPublic,
          bestShare: stat.bestShare,
          sharesCount: stat.sharesCount,
          rank: stat.rank,
          participated: stat.participated,
          streakAtTime: stat.streakAtTime,
          xpGained: stat.xpGained,
          totalXpAfter: stat.totalXpAfter,
          levelAfter: stat.levelAfter,
          createdAt: stat.createdAt,
        })),
      }));

      console.log("✅ Résultat history récupéré");
      console.log("📊 Nombre de rounds :", result.length);

      if (result.length > 0) {
        console.log("🧪 Premier round history :", JSON.stringify(result[0], null, 2));
      }

      return result;
    } catch (error) {
      console.log("❌ ERREUR /api/history");
      console.log(error);

      if (error instanceof Error) {
        console.log("STACK :", error.stack);
      }

      throw error;
    }
  }

  @Get("/workers")
  async workers() {
    console.log("➡️ /api/workers appelé");

    try {
      console.log("🔍 Lancement requête Prisma workers...");

      const workers = await this.prisma.workerProfile.findMany({
        orderBy: [{ xp: "desc" }, { level: "desc" }, { bestShareEver: "desc" }],
        select: {
          id: true,
          worker: true,
          bestShareEver: true,
          totalShares: true,
          roundsParticipated: true,
          currentStreak: true,
          bestStreak: true,
          xp: true,
          level: true,
          createdAt: true,
          updatedAt: true,
          address: {
            select: {
              id: true,
              label: true,
              isPublic: true,
            },
          },
        },
      });

      const result = workers.map((worker) => ({
        id: worker.id,
        address: worker.address.label,
        isPublic: worker.address.isPublic,
        worker: worker.worker,
        bestShareEver: worker.bestShareEver,
        totalShares: worker.totalShares,
        roundsParticipated: worker.roundsParticipated,
        currentStreak: worker.currentStreak,
        bestStreak: worker.bestStreak,
        xp: worker.xp,
        level: worker.level,
        createdAt: worker.createdAt,
        updatedAt: worker.updatedAt,
      }));

      console.log("✅ Résultat workers récupéré");
      console.log("📊 Nombre de workers :", result.length);

      if (result.length > 0) {
        console.log("🧪 Premier worker :", JSON.stringify(result[0], null, 2));
      }

      return result;
    } catch (error) {
      console.log("❌ ERREUR /api/workers");
      console.log(error);

      if (error instanceof Error) {
        console.log("STACK :", error.stack);
      }

      throw error;
    }
  }
}