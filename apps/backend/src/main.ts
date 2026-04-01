import { NestFactory } from "@nestjs/core";
import * as v8 from "v8";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3007",
      "https://shares-viewer.chauffagistes-btc.fr",
    ],
    credentials: true,
  });

  // setInterval(() => {
  //   const memory = process.memoryUsage();
  //   const heapStats = v8.getHeapStatistics();

  //   console.log("[Memory]", {
  //     rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
  //     heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
  //     heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
  //     external: `${Math.round(memory.external / 1024 / 1024)} MB`,
  //     arrayBuffers: `${Math.round(memory.arrayBuffers / 1024 / 1024)} MB`,
  //     heapLimit: `${Math.round(heapStats.heap_size_limit / 1024 / 1024)} MB`,
  //   });
  // }, 10000);

  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3001);
}

bootstrap();