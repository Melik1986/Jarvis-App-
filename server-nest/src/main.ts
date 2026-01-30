import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS with dynamic origins
  app.enableCors({
    origin: (origin, callback) => {
      const origins = new Set<string>();

      if (process.env.REPLIT_DEV_DOMAIN) {
        origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
      }

      if (process.env.REPLIT_DOMAINS) {
        process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
          origins.add(`https://${d.trim()}`);
        });
      }

      // Allow localhost for Expo development
      const isLocalhost =
        origin?.startsWith("http://localhost:") ||
        origin?.startsWith("http://127.0.0.1:");

      if (!origin || origins.has(origin) || isLocalhost) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Set global prefix
  app.setGlobalPrefix("api");

  const port = process.env.PORT || 5000;
  await app.listen(port);
  console.log(`Nest.js server running on port ${port}`);
}

bootstrap();
