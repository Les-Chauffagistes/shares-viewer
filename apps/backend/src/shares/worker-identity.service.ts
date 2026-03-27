import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../redis/redis.service";

export type ResolvedWorkerIdentity = {
  rawAddress: string;
  addressId: string;
  addressLabel: string;
  rawWorkerName: string;
  workerLabel: string;
  displayName: string;
  isPublic: boolean;
};

@Injectable()
export class WorkerIdentityService {
  private readonly logger = new Logger(WorkerIdentityService.name);

  private static readonly PUBLIC_ADDRESS =
    "bc1qqp9zq4an6nyzhcspz2xfmkcf8rj0p6w94a5gyeu2a7rghxjhnqqsvymz5m";

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private get redis() {
    return this.redisService.client;
  }

  async resolve(address: string, workerName: string): Promise<ResolvedWorkerIdentity> {
    const isPublic = address === WorkerIdentityService.PUBLIC_ADDRESS;
    const addressId = this.toAddressId(address);
    const addressLabel = this.toDisplayAddress(address);

    if (isPublic) {
      const workerLabel = this.extractWorkerSuffix(workerName);

      return {
        rawAddress: address,
        addressId,
        addressLabel,
        rawWorkerName: workerName,
        workerLabel,
        displayName: `${addressLabel}.${workerLabel}`,
        isPublic: true,
      };
    }

    const cacheKey = this.workerAliasCacheKey(addressId, workerName);
    const cachedWorkerLabel = await this.redis.get(cacheKey);

    if (cachedWorkerLabel) {
      return {
        rawAddress: address,
        addressId,
        addressLabel,
        rawWorkerName: workerName,
        workerLabel: cachedWorkerLabel,
        displayName: `${addressLabel}.${cachedWorkerLabel}`,
        isPublic: false,
      };
    }

    const existing = await this.prisma.workerProfile.findUnique({
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

    if (existing) {
      await this.cacheAlias(addressId, workerName, existing.worker);

      return {
        rawAddress: address,
        addressId,
        addressLabel: existing.address.label,
        rawWorkerName: workerName,
        workerLabel: existing.worker,
        displayName: `${existing.address.label}.${existing.worker}`,
        isPublic: existing.address.isPublic,
      };
    }

    const created = await this.findOrCreateWorkerProfile(address, addressId, workerName);

    await this.cacheAlias(addressId, workerName, created.worker);

    return {
      rawAddress: address,
      addressId,
      addressLabel: created.address.label,
      rawWorkerName: workerName,
      workerLabel: created.worker,
      displayName: `${created.address.label}.${created.worker}`,
      isPublic: created.address.isPublic,
    };
  }

  private async findOrCreateWorkerProfile(
    rawAddress: string,
    addressId: string,
    workerName: string,
  ) {
    const addressLabel = this.toDisplayAddress(rawAddress);

    await this.prisma.workerAddress.upsert({
      where: { id: addressId },
      update: {
        rawAddress,
        isPublic: false,
        label: addressLabel,
      },
      create: {
        id: addressId,
        rawAddress,
        isPublic: false,
        label: addressLabel,
      },
    });

    const alreadyExisting = await this.prisma.workerProfile.findUnique({
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

    if (alreadyExisting) {
      return alreadyExisting;
    }

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const countForAddress = await this.prisma.workerProfile.count({
        where: { addressId },
      });

      const nextAlias = `worker${countForAddress + 1 + attempt}`;

      try {
        return await this.prisma.workerProfile.create({
          data: {
            addressId,
            workerName,
            worker: nextAlias,
          },
          include: {
            address: true,
          },
        });
      } catch (error: any) {
        if (this.isUniqueConstraintError(error)) {
          const existing = await this.prisma.workerProfile.findUnique({
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

          if (existing) {
            return existing;
          }

          this.logger.warn(
            `Collision d'alias pour ${addressId}.${workerName} sur ${nextAlias}, nouvelle tentative`,
          );

          continue;
        }

        throw error;
      }
    }

    throw new Error(
      `Impossible de créer un alias stable pour ${addressId}.${workerName} après plusieurs tentatives`,
    );
  }

  private async cacheAlias(
    addressId: string,
    workerName: string,
    workerLabel: string,
  ): Promise<void> {
    await this.redis.set(
      this.workerAliasCacheKey(addressId, workerName),
      workerLabel,
      "EX",
      86400,
    );
  }

  private workerAliasCacheKey(addressId: string, workerName: string): string {
    return `sv:worker_alias:${addressId}:${workerName}`;
  }

  private toDisplayAddress(address: string): string {
    if (address === WorkerIdentityService.PUBLIC_ADDRESS) {
      return "chauff_pool";
    }

    if (address.length <= 11) {
      return address;
    }

    return `${address.slice(0, 7)}...${address.slice(-4)}`;
  }

  private toAddressId(address: string): string {
    if (address === WorkerIdentityService.PUBLIC_ADDRESS) {
      return "chauff_pool";
    }

    return address;
  }

  private extractWorkerSuffix(workerName: string): string {
    const lastDotIndex = workerName.lastIndexOf(".");

    if (lastDotIndex === -1 || lastDotIndex === workerName.length - 1) {
      return workerName;
    }

    return workerName.slice(lastDotIndex + 1);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    );
  }
}