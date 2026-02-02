import { Module, Global } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../../shared/schema";
import { AppLogger } from "../utils/logger";

export const DATABASE_CONNECTION = "DATABASE_CONNECTION";

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>("DATABASE_URL");
        if (!connectionString) {
          AppLogger.info(
            "Stateless Mode: No DATABASE_URL provided. Database features are disabled.",
          );
          return null;
        }
        try {
          const pool = new Pool({ connectionString });
          return drizzle(pool, { schema });
        } catch (error) {
          AppLogger.warn("Failed to initialize database connection:", error);
          return null;
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DbModule {}

export type Database = NodePgDatabase<typeof schema> | null;
