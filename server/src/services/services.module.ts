import { Module, Global } from "@nestjs/common";
import { TokenExchangeService } from "./token-exchange.service";
import { EphemeralClientPoolService } from "./ephemeral-client-pool.service";
import { CircuitBreakerService } from "./circuit-breaker.service";
import { McpBridgeService } from "./mcp-bridge.service";
import { McpHostService } from "./mcp-host.service";
import { OpenApiToolGeneratorService } from "./openapi-tool-generator.service";
import { ValidationService } from "./validation.service";
import { OutboundUrlPolicy } from "../security/outbound-url-policy";

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
    OutboundUrlPolicy,
  ],
  exports: [
    TokenExchangeService,
    EphemeralClientPoolService,
    CircuitBreakerService,
    McpBridgeService,
    McpHostService,
    OpenApiToolGeneratorService,
    ValidationService,
    OutboundUrlPolicy,
  ],
})
export class ServicesModule {}
