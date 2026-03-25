import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SharesService } from "./shares.service";
import { SharesStreamService } from "./shares-stream.service";
import { RealtimeModule } from "../realtime/realtime.module";
import { RoundStateModule } from "../round-state/round-state.module";

@Module({
  imports: [ConfigModule, RealtimeModule, RoundStateModule],
  providers: [SharesService, SharesStreamService],
  exports: [SharesService],
})
export class SharesModule {}