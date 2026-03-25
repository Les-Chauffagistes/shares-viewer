import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SharesService } from "./shares.service";
import { SharesStreamService } from "./shares-stream.service";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [ConfigModule, RealtimeModule],
  providers: [SharesService, SharesStreamService],
  exports: [SharesService],
})
export class SharesModule {}