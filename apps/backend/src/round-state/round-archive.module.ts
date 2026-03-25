import { Module } from "@nestjs/common";
import { LevelService } from "./level.service";
import { RoundStateService } from "./round-state.service";
import { RoundArchiveService } from "./round-archive.service";

@Module({
  providers: [LevelService, RoundStateService, RoundArchiveService],
  exports: [LevelService, RoundStateService, RoundArchiveService],
})
export class RoundStateModule {}