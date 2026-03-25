import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>("REDIS_HOST", "127.0.0.1"),
      port: Number(this.configService.get<number>("REDIS_PORT", 6379)),
      db: Number(this.configService.get<number>("REDIS_DB", 0)),
      maxRetriesPerRequest: null,
    });

    this.redis.on("connect", () => this.logger.log("Connecté à Redis"));
    this.redis.on("error", (err) =>
      this.logger.error(`Erreur Redis: ${err.message}`),
    );
  }

  get client(): Redis {
    return this.redis;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}