import { Controller, Get } from "@nestjs/common";
import { SharesService } from "./shares/shares.service";

@Controller()
export class AppController {
  constructor(private readonly sharesService: SharesService) {}

  @Get("/health")
  health() {
    return { ok: true };
  }

  @Get("/live")
  live() {
    return this.sharesService.getLiveState();
  }

  @Get("/history")
  history() {
    return this.sharesService.getHistory();
  }
}