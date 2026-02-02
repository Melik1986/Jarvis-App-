import { Module, Global } from "@nestjs/common";
import { TokenExchangeService } from "./token-exchange.service";
import { EphemeralClientPoolService } from "./ephemeral-client-pool.service";
import { CircuitBreakerService } from "./circuit-breaker.service";
import { McpBridgeService } from "./mcp-bridge.service";

@Global()
@Module({
  providers: [
    TokenExchangeService,
    EphemeralClientPoolService,
    CircuitBreakerService,
    McpBridgeService,
  ],
  exports: [
    TokenExchangeService,
    EphemeralClientPoolService,
    CircuitBreakerService,
    McpBridgeService,
  ],
})
export class ServicesModule {}
