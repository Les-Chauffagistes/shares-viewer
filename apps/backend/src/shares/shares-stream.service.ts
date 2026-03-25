import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import WebSocket from "ws";
import { RawShareMessage } from "@shares-viewer/types";
import { SharesService } from "./shares.service";

@Injectable()
export class SharesStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SharesStreamService.name);
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private manuallyClosed = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly sharesService: SharesService,
  ) {}

  onModuleInit() {
    this.connect();
  }

  onModuleDestroy() {
    this.manuallyClosed = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private connect() {
    const url = this.configService.get<string>("SHARES_WS_URL");
    const token = this.configService.get<string>("SHARES_WS_TOKEN");

    if (!url) {
      this.logger.error("SHARES_WS_URL manquant dans le .env");
      return;
    }

    if (!token) {
      this.logger.error("SHARES_WS_TOKEN manquant dans le .env");
      return;
    }

    this.logger.log(`Connexion au websocket global: ${url}`);

    this.ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    this.ws.on("open", () => {
      this.logger.log("Connecté au websocket global");
    });

    this.ws.on("message", async (data) => {
      try {
        const text = data.toString();
        if (!text) return;

        const parsed = JSON.parse(text) as RawShareMessage;

        if (parsed.type !== "share" || !parsed.share) {
          return;
        }

        await this.sharesService.ingest(parsed);
      } catch (error) {
        this.logger.warn(
          `Message websocket ignoré: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    });

    this.ws.on("error", (error) => {
      this.logger.error(`Erreur websocket: ${error.message}`);
    });

    this.ws.on("close", (code, reason) => {
      this.logger.warn(
        `Websocket fermé (code=${code}, reason=${reason.toString() || "n/a"})`,
      );

      this.ws = null;

      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;

    this.logger.log("Nouvelle tentative de connexion dans 5 secondes...");

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 5000);
  }
}