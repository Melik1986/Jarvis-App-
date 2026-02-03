import { Module, Global } from "@nestjs/common";
import { TokenExchangeService } from "./token-exchange.service";
import { EphemeralClientPoolService } from "./ephemeral-client-pool.service";
import { CircuitBreakerService } from "./circuit-breaker.service";
import { McpBridgeService } from "./mcp-bridge.service";
import { McpHostService } from "./mcp-host.service";
import { OpenApiToolGeneratorService } from "./openapi-tool-generator.service";
import { ValidationService } from "./validation.service";

@Global()
@Module({
  providers: [
    TokenExchangeService,
    EphemeralClientPoolService,
    CircuitBreakerService,
    McpBridgeService,
    McpHostService,
    OpenApiToolGeneratorService,
    ValidationService,
  ],
  exports: [
    TokenExchangeService,
    EphemeralClientPoolService,
    CircuitBreakerService,
    McpBridgeService,
    McpHostService,
    OpenApiToolGeneratorService,
    ValidationService,
  ],
})
export class ServicesModule {}
