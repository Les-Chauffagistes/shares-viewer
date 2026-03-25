import { Controller, Get, Param } from "@nestjs/common";
import { SharesService } from "./shares/shares.service";
import { PrismaService } from "./database/prisma.service";

@Controller()
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
    return this.sharesService.getLiveState();
  }

  @Get("/history")
  async history() {
    return this.prisma.roundArchive.findMany({
      orderBy: { endedAt: "desc" },
      take: 5,
      include: {
        workerStats: {
          orderBy: { rank: "asc" },
        },
      },
    });
  }

  @Get("/workers/:workerName")
  async worker(@Param("workerName") workerName: string) {
    return this.prisma.workerProfile.findUnique({
      where: { workerName },
    });
  }
}