import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as express from "express";
import session from "express-session";
import passport from "passport";
import * as fs from "fs";
import * as path from "path";
import { AppModule } from "./app.module";
import { AppLogger } from "./utils/logger";
import { LlmProviderExceptionFilter } from "./filters/llm-provider-exception.filter";

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: express.Response) {
  const normalizedPlatform = platform.toLowerCase();
  if (normalizedPlatform !== "ios" && normalizedPlatform !== "android") {
    return res.status(400).json({ error: `Unsupported platform: ${platform}` });
  }

  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    normalizedPlatform,
    "manifest.json",
  );
  const staticBuildRoot = path.resolve(process.cwd(), "static-build");
  const relativePath = path.relative(staticBuildRoot, manifestPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return res.status(400).json({ error: "Invalid manifest path" });
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();

  // Enable CORS with dynamic origins
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      const origins = new Set<string>();

      if (process.env.REPLIT_DEV_DOMAIN) {
        origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
      }

      if (process.env.REPLIT_DOMAINS) {
        process.env.REPLIT_DOMAINS.split(",").forEach((d: string) => {
          origins.add(`https://${d.trim()}`);
        });
      }

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

  // Session middleware for Replit Auth
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "axon-session-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      },
    }),
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Global exception filter for LLM provider errors (user-friendly messages)
  app.useGlobalFilters(new LlmProviderExceptionFilter());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Set global prefix for API routes
  app.setGlobalPrefix("api");

  // Swagger OpenAPI (dev: /api/docs)
  const swaggerConfig = new DocumentBuilder()
    .setTitle("AXON API")
    .setDescription("Universal AI ERP OS — Chat, Conductor, Auth, RAG")
    .setVersion("1.0")
    .addTag("conversations", "Chat & Conductor")
    .addTag("auth", "Authentication")
    .addTag("rag", "Knowledge Base (RAG)")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  // Serve static Expo files
  const staticBuildPath = path.resolve(process.cwd(), "static-build");
  if (fs.existsSync(staticBuildPath)) {
    expressApp.use("/static-build", express.static(staticBuildPath));
  }

  // Landing page and Expo manifest routing
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const appName = getAppName();

  AppLogger.info("Serving static Expo files with dynamic manifest routing");
  AppLogger.info(
    "Expo routing: Checking expo-platform header on / and /manifest",
  );

  // Handle Expo manifest requests
  expressApp.get(
    ["/", "/manifest"],
    (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const platform = req.headers["expo-platform"] as string;
      if (platform) {
        return serveExpoManifest(platform, res);
      }

      // Serve landing page for browser requests
      if (fs.existsSync(templatePath)) {
        const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
        const forwardedProto = req.header("x-forwarded-proto");
        const protocol = forwardedProto || req.protocol || "https";
        const forwardedHost = req.header("x-forwarded-host");
        const host = forwardedHost || req.get("host");
        const baseUrl = `${protocol}://${host}`;
        const expsUrl = `${host}`;

        const html = landingPageTemplate
          .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
          .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
          .replace(/APP_NAME_PLACEHOLDER/g, appName);

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(html);
      }

      next();
    },
  );

  const port = process.env.PORT || 5000;
  await app.listen(port, "0.0.0.0");
  AppLogger.info(`Nest.js server running on port ${port} (0.0.0.0)`);
}

bootstrap();
