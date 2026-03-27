import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
} from "@nestjs/common";
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
          include: {
            address: true,
          },
        },
      },
    });
  }

  @Get("/workers/:rawWorkerName")
  async worker(@Param("rawWorkerName") rawWorkerName: string) {
    const parsed = this.parseWorkerIdentifier(rawWorkerName);

    if (!parsed) {
      throw new BadRequestException(
        "Format attendu: address.worker",
      );
    }

    const addressId = this.toAddressId(parsed.address);
    const workerName = parsed.workerName;

    const worker = await this.prisma.workerProfile.findUnique({
      where: {
        addressId_workerName: {
          addressId,
          workerName,
        },
      },
      include: {
        address: true,
      },
    });

    if (!worker) {
      throw new NotFoundException("Worker introuvable");
    }

    return worker;
  }

  private parseWorkerIdentifier(
    rawWorkerName: string,
  ): { address: string; workerName: string } | null {
    const separatorIndex = rawWorkerName.lastIndexOf(".");

    if (separatorIndex <= 0 || separatorIndex === rawWorkerName.length - 1) {
      return null;
    }

    const address = rawWorkerName.slice(0, separatorIndex).trim();
    const workerName = rawWorkerName.slice(separatorIndex + 1).trim();

    if (!address || !workerName) {
      return null;
    }

    return { address, workerName };
  }

  private toAddressId(address: string): string {
    if (
      address ===
      "bc1qqp9zq4an6nyzhcspz2xfmkcf8rj0p6w94a5gyeu2a7rghxjhnqqsvymz5m"
    ) {
      return "chauff_pool";
    }

    return address;
  }
}