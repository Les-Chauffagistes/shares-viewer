import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from "@nestjs/websockets";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://ton-frontend.com",
    ],
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Client connecté: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client déconnecté: ${client.id}`);
  }

  emitLiveState(payload: unknown) {
    this.server.emit("live_state", payload);
  }

  emitWorkerShareUpdated(payload: unknown) {
    this.server.emit("worker_share_updated", payload);
  }

  emitRoundReset(payload: unknown) {
    this.server.emit("round_reset", payload);
  }
}