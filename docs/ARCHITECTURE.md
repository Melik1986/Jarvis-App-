# AXON System Architecture Guide

**Version:** 1.0.0  
**Status:** Production-Ready MVP+  
**Last Updated:** 11 Feb 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture Principles](#core-architecture-principles)
3. [System Design](#system-design)
4. [Module Structure](#module-structure)
5. [Data Flow](#data-flow)
6. [Security Architecture](#security-architecture)
7. [Scalability](#scalability)
8. [Design Patterns](#design-patterns)

---

## Overview

### What is AXON?

**AXON** is a **Voice-to-ERP AI Orchestrator** — a mobile-first application that transforms natural language commands and visual inputs into structured ERP operations. It bridges the gap between unstructured user communication and rigid enterprise systems.

### Supported Platforms

- **Mobile:** iOS 13+, Android 8+ (via React Native & Expo)
- **Web:** Browser-based (Expo Web)
- **Backend:** Cloud (AWS, Azure, GCP) or On-premise (Docker)

### Key Metrics

| Metric                | Value                                              |
| --------------------- | -------------------------------------------------- |
| **Codebase**          | React Native + NestJS (TypeScript)                 |
| **Frontend SDK**      | Expo SDK 55                                        |
| **Backend Framework** | NestJS 11                                          |
| **Primary Database**  | PostgreSQL (Supabase)                              |
| **Mobile Storage**    | SQLite (zero-server)                               |
| **LLM Providers**     | 5+ (OpenAI, Groq, Ollama, OpenRouter, Together AI) |
| **ERP Integrations**  | 4+ (1C, SAP, Odoo, MoySklad)                       |

---

## Core Architecture Principles

### 1. Zero-Storage (Stateless Server)

**Principle:** The server **does not store** user data, conversation history, rules, or settings.

**Implementation:**

- Client sends complete state in each request (message, history, rules, skills, settings)
- Server processes and returns response (streams via SSE)
- Stateless design enables unlimited horizontal scaling

**Advantages:**

```
✅ Privacy: No sensitive data on server
✅ Scalability: No session/cache management
✅ Reliability: No data loss on server crash
✅ Compliance: GDPR-friendly (no data retention)
```

**Trade-off:**

```
⚠️ Bandwidth: Each request includes full history
⚠️ Solution: Client-side message compression & pagination
```

**Code Example:**

```typescript
// Client sends entire state
@Post('/chat')
async chat(@Body() body: ChatRequestDto) {
  // body includes:
  // - message: current user input
  // - conversationHistory: all messages
  // - rules: business rules
  // - skills: custom functions
  // - llmSettings: AI configuration
  // - erpSettings: ERP credentials

  // Server processes and returns stream (no storage)
  return this.chatService.streamResponse(body, req.user.id);
}
```

---

### 2. Offline-First

**Principle:** App works without internet; syncs when available.

**Implementation:**

- Local SQLite database on client for all data
- React Query for intelligent caching
- Zustand stores with AsyncStorage persistence
- Graceful degradation when offline

**Architecture:**

```
┌─────────────────────────────────────────┐
│      React Native Client (Expo)         │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐   │
│  │   Zustand Stores (In-Memory)    │   │
│  │  - authStore                    │   │
│  │  - chatStore                    │   │
│  │  - inventoryStore               │   │
│  │  - settingsStore                │   │
│  └──────────────┬────────────────────│   │
│                 │ persist()          │   │
│  ┌──────────────▼────────────────────│   │
│  │   AsyncStorage + SecureStore     │   │
│  │  (encrypted for sensitive data)  │   │
│  └──────────────┬────────────────────│   │
│                 │                    │   │
│  ┌──────────────▼────────────────────│   │
│  │      SQLite Database             │   │
│  │  - conversations                 │   │
│  │  - messages                      │   │
│  │  - rules                         │   │
│  │  - skills                        │   │
│  │  - vector_embeddings (RAG)       │   │
│  └─────────────────────────────────┘   │
│                                         │
│   Works WITHOUT internet ✅            │
└─────────────────────────────────────────┘
        │ (when online)
        ▼
┌─────────────────────────────────────────┐
│        NestJS Backend (Server)          │
│  - LLM orchestration                    │
│  - ERP integration                      │
│  - RAG search (Qdrant)                  │
│  - Authentication                      │
└─────────────────────────────────────────┘
```

**Data Sync Strategy:**

```typescript
// On app resume or network reconnect
const { isOnline } = useNetInfo();
useEffect(() => {
  if (isOnline) {
    // Sync local changes to server
    inventoryStore.syncPendingOperations();
  }
}, [isOnline]);
```

---

### 3. Zero-Knowledge Privacy

**Principle:** Sensitive data is encrypted end-to-end. The server **never sees** API keys, credentials, or private documents.

**Implementation:**

#### JWE Encryption (JSON Web Encryption)

```typescript
// Client encrypts credentials before sending
const encrypted = await jweEncrypt({
  apiKey: 'sk-...',
  erpPassword: 'secret',
  customData: {...}
}, serverPublicKey, {
  alg: 'ECDH-ES+HKDF-256',
  enc: 'A256GCM'
});

// POST to server with encrypted payload
fetch('/api/chat', {
  body: JSON.stringify({
    message: '...',
    encryptedCredentials: encrypted // Server can't decrypt!
  })
});
```

#### Ephemeral Client Pool

```typescript
// Server maintains in-memory OpenAI clients
// Each client created on-demand from encrypted credentials
// Auto-evicted after TTL (5 min for streaming, 1 min for regular)
class EphemeralClientPoolService {
  private cache = new Map(); // LRU cache
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly TTL = 5 * 60 * 1000; // 5 min

  getOrCreateClient(encryptedCreds: string): OpenAI {
    // 1. Decrypt credentials (in memory only)
    // 2. Create OpenAI client
    // 3. Add to cache with TTL
    // 4. On TTL expire: auto-remove from cache
    // Result: Credentials never persisted to disk
  }
}
```

#### Hardware-Backed Storage (Mobile)

```typescript
// Sensitive data stored in device secure enclave
// iOS: Secure Enclave + Keychain
// Android: StrongBox Keystore (TEE)

const { SecureStore } = require("expo-secure-store");

// Store API key in Secure Enclave
await SecureStore.setItemAsync("OPENAI_KEY", apiKey);

// Retrieve (requires biometric auth if enabled)
const key = await SecureStore.getItemAsync("OPENAI_KEY");
```

---

### 4. Conductor Pattern

**Principle:** The client acts as **Conductor** (orchestrator). The server is a **Stateless Executor** of decisions made by the client.

**Responsibility Distribution:**

```
CLIENT (Conductor)                SERVER (Executor)
├─ Stores configuration          ├─ Calls APIs
├─ Manages conversation state    ├─ Streams responses
├─ Applies business rules        ├─ Executes tools
├─ Validates operations          ├─ Handles encryption
├─ Stores sensitive data         └─ Manages TTL pools
└─ Decides what to do next

The server NEVER decides:
- What LLM to use
- What ERP to call
- Whether to execute operation
- How to validate business rules
```

**Example Flow:**

```
1. User: "Create invoice for customer #123"
2. Client:
   - ✓ Loads customer #123 from cache
   - ✓ Applies rules (price validation, etc.)
   - ✓ Encrypts ERP credentials
   - ✓ Sends to server with full context
3. Server:
   - ✓ Decrypts credentials (ephemeral, auto-deleted)
   - ✓ Calls ERP API
   - ✓ Returns result
   - ✓ Forgets credentials immediately
4. Client:
   - ✓ Stores result in local SQLite
   - ✓ Displays to user
   - ✓ Syncs later if needed
```

---

### 5. Chain of Verification (CoVe)

**Principle:** Before executing any write operation, verify its preconditions with read operations.

**Example:**

```
User: "Create purchase order for $50,000"
↓
Before creating, verify:
1. Supplier exists and is active
2. Budget available for this fiscal year
3. Previous orders with this supplier (check history)
↓
If all conditions met → Create order
Otherwise → Propose modifications
```

**Implementation:**

```typescript
class CoveWorkflowService {
  needsVerification(toolCall: ToolCall): boolean {
    // Check if tool is write operation (create, update, delete)
    return ["create", "update", "delete"].some((op) =>
      toolCall.name.startsWith(op),
    );
  }

  getVerificationTools(toolCall: ToolCall): Tool[] {
    // Generate read tools for verification
    if (toolCall.name === "create_invoice") {
      return [
        { name: "get_customer", args: { customerId } },
        { name: "get_stock", args: { productIds } },
        { name: "check_credit_limit", args: { customerId } },
      ];
    }
  }
}
```

---

### 6. Guardian Guard

**Principle:** Pre-execution validation gate. All tool calls must pass multiple checks before execution.

**Guard Layers:**

```
Tool Call
  │
  ▼
┌─────────────────────────┐
│  1. Semantic Validation │ ← Check data types, ranges
│  (hardcoded rules)      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  2. Rulebook Validation │ ← Check client rules
│  (client-provided)      │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  3. Confidence Scoring  │ ← Assess AI certainty
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  4. Action Resolution   │ ← allow/reject/warn/confirm
└────────┬────────────────┘
         │
         ▼
Execute or Reject
```

**Example Rules:**

```json
[
  {
    "tool": "create_invoice",
    "field": "quantity",
    "operator": "<",
    "value": 0,
    "action": "reject",
    "message": "Negative quantity not allowed"
  },
  {
    "tool": "create_invoice",
    "field": "totalAmount",
    "operator": ">",
    "value": 10000,
    "action": "require_confirmation",
    "message": "Large amount requires approval"
  }
]
```

---

## System Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  React Native Client (Expo)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Voice Input │  │ Vision (OCR) │  │ Text Chat    │           │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                │                │                    │
│         └────────────────┼────────────────┘                    │
│                          ▼                                     │
│              ┌─────────────────────┐                           │
│              │   Zustand Stores    │                           │
│              │   (Local State)     │                           │
│              └──────────┬──────────┘                           │
│                         │                                      │
│              ┌──────────▼──────────┐                           │
│              │  AsyncStorage/      │                           │
│              │  SecureStore        │                           │
│              │  (Persistence)      │                           │
│              └──────────┬──────────┘                           │
│                         │                                      │
│              ┌──────────▼──────────┐                           │
│              │   SQLite Database   │                           │
│              │   (Zero-Storage)    │                           │
│              └──────────┬──────────┘                           │
└─────────────────────────┼──────────────────────────────────────┘
                          │
                          │ HTTPS + JWE Encryption
                          │ (stateless POST with full context)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NestJS Backend Server                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  API Gateway                            │   │
│  │  - Rate Limiting (100 req/min per user)               │   │
│  │  - JWT Validation                                      │   │
│  │  - JWE Decryption                                      │   │
│  │  - CORS                                                │   │
│  └────────────┬────────────────────────────────────────────┘   │
│               │                                                │
│  ┌────────────▼────────────────────────────────────────────┐   │
│  │              Chat Module                               │   │
│  │  ┌─────────────────────────────────────────────┐      │   │
│  │  │ AI Service (Vercel AI SDK)                 │      │   │
│  │  │ - Multi-provider support                   │      │   │
│  │  │ - Tool function calling                    │      │   │
│  │  │ - Streaming responses                      │      │   │
│  │  └──────────────┬────────────────────────────┘      │   │
│  │                 │                                     │   │
│  │  ┌──────────────▼────────────────────────────┐      │   │
│  │  │ Tool Registry Service                     │      │   │
│  │  │ - Dynamic tool generation (OpenAPI)       │      │   │
│  │  │ - Tool validation                         │      │   │
│  │  │ - Confidence scoring                      │      │   │
│  │  └──────────────┬────────────────────────────┘      │   │
│  └─────────────────┼────────────────────────────────────┘   │
│                    │                                        │
│  ┌─────────────────┼────────────────────────────────────┐   │
│  │              ERP Module                            │   │
│  │  ┌────────────────────────────────────────────┐    │   │
│  │  │ ERP Adapters                              │    │   │
│  │  │ - 1C OData Adapter                        │    │   │
│  │  │ - SAP REST Adapter                        │    │   │
│  │  │ - Odoo JSON-RPC Adapter                   │    │   │
│  │  │ - Generic OpenAPI/Swagger Adapter         │    │   │
│  │  └──────────────┬───────────────────────────┘    │   │
│  └─────────────────┼────────────────────────────────┘   │
│                    │                                    │
│  ┌─────────────────┼────────────────────────────────┐   │
│  │              RAG Module                        │   │
│  │  ┌────────────────────────────────────────┐   │   │
│  │  │ Vector Store Providers                │   │   │
│  │  │ - Qdrant (self-hosted)               │   │   │
│  │  │ - Supabase Vector (managed)          │   │   │
│  │  │ - Local Vector Search (client-side)  │   │   │
│  │  └──────────────┬───────────────────────┘   │   │
│  └─────────────────┼────────────────────────────┘   │
│                    │                                │
│  ┌─────────────────┼────────────────────────────┐   │
│  │              MCP Module                     │   │
│  │  - Model Context Protocol integration       │   │
│  │  - External tool server support            │   │
│  └─────────────────┼────────────────────────────┘   │
│                    │                                │
│  ┌─────────────────┼────────────────────────────┐   │
│  │              Guardian Guard                 │   │
│  │  - Pre-execution validation                │   │
│  │  - Rule enforcement                        │   │
│  │  - Confidence checks                       │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
        │        │         │         │
        ▼        ▼         ▼         ▼
    ┌────┐ ┌──────┐   ┌──────┐  ┌────────┐
    │1C  │ │ SAP  │   │Odoo  │  │Qdrant  │
    │API │ │ API  │   │ API  │  │ Vector │
    └────┘ └──────┘   └──────┘  │ Store  │
                               └────────┘
```

---

## Module Structure

### Backend Modules

#### `chat/` - AI Orchestration

```
chat/
├── chat.controller.ts         # REST endpoints
├── chat.service.ts            # Core streaming logic (1000+ lines)
├── chat.dto.ts                # Request/response DTOs
├── tool-registry.service.ts   # Dynamic tool generation
├── confidence-scorer.service.ts # Certainty calculation
├── cove-workflow.service.ts   # Verification workflow
└── tool-execution-pipeline.ts # Tool call execution
```

**Key Responsibilities:**

- Stream AI responses via SSE
- Parse tool calls from LLM
- Validate tools before execution
- Score confidence in responses
- Generate verification workflows

---

#### `erp/` - Enterprise System Integration

```
erp/
├── erp.controller.ts          # REST endpoints
├── erp.service.ts             # Orchestrator
├── adapters/
│   ├── 1c-odata.adapter.ts    # 1C Enterprise
│   ├── sap-rest.adapter.ts    # SAP
│   ├── odoo-rpc.adapter.ts    # Odoo
│   ├── generic-openapi.adapter.ts
│   └── mock-erp.adapter.ts    # Testing
└── schemas/                   # ERP schema definitions
```

**Responsibility:**

- Abstract different ERP APIs
- Generate tools from ERP schema
- Handle ERP errors gracefully
- Cache ERP metadata

---

#### `llm/` - LLM Provider Management

```
llm/
├── llm.service.ts             # Provider orchestration
├── providers/
│   ├── openai.provider.ts
│   ├── groq.provider.ts
│   ├── ollama.provider.ts
│   ├── openrouter.provider.ts
│   └── together-ai.provider.ts
└── ephemeral-client-pool.ts   # Credential management
```

**Responsibility:**

- Multi-provider support
- Credential lifecycle management
- Model selection logic
- Cost tracking

---

#### `rag/` - Knowledge Base Search

```
rag/
├── rag.controller.ts          # REST endpoints
├── rag.service.ts             # Search orchestration
├── providers/
│   ├── qdrant.provider.ts
│   ├── supabase.provider.ts
│   └── local-vector.provider.ts
├── document-ingestion.service.ts
└── chunk-strategy.ts          # Document chunking
```

---

#### `rules/` & `skills/`

```
rules/
├── rulebook.controller.ts     # CRUD + parsing
├── rulebook.service.ts        # Rule engine
└── rule-parser.ts             # Markdown parsing

skills/
├── skill.controller.ts        # CRUD + import
├── skill.service.ts           # Skill management
└── sandbox-executor.ts        # Isolated JS execution
```

---

### Frontend Components

#### Chat Screen

```typescript
// client/screens/ChatScreen.tsx
- Message list (Gifted Chat)
- Text input + voice button
- Tool call preview
- Confidence indicator
- Error handling + retry
```

#### Settings Screens

```typescript
// LLM Provider Configuration
// ERP Connection Settings
// RAG Knowledge Base
// Rules Management
// Skills Management
// MCP Server Registration
```

---

## Data Flow

### Request-Response Cycle

```
1. USER INPUT
   ├─ Voice: Audio → Whisper Transcription
   ├─ Vision: Photo → GPT-4o Vision → Recognized items
   └─ Text: Direct chat message

2. CLIENT PREPARATION
   ├─ Load conversation history from SQLite
   ├─ Load rules from SQLite
   ├─ Load skills from SQLite
   ├─ Load LLM settings from SecureStore
   ├─ Load ERP credentials (encrypted via JWE)
   └─ Compress payload if needed

3. REQUEST TO SERVER
   POST /api/chat {
     message,
     conversationHistory,
     rules,
     skills,
     llmSettings,
     erpSettings (JWE-encrypted),
     ragSettings
   }

4. SERVER PROCESSING
   ├─ Validate JWT
   ├─ Decrypt JWE credentials
   ├─ Get or create LLM client (ephemeral pool)
   ├─ Invoke LLM with system prompt + tools
   ├─ Stream token chunks to client
   │
   ├─ LLM returns tool_call:
   │  {
   │    "name": "get_stock",
   │    "arguments": { "productId": 42 }
   │  }
   │
   ├─ Tool Registry validates tool
   ├─ Guardian Guard checks rules
   ├─ Execute tool (call ERP API)
   ├─ Stream tool_result back to client
   │
   └─ Continue until LLM stops calling tools

5. CLIENT RECEIVES STREAM
   SSE events:
   - "data: {type: 'text_chunk', content: 'Hello'}"
   - "data: {type: 'tool_call', ...}"
   - "data: {type: 'tool_result', ...}"
   - "data: {type: 'done', metadata: {tokens, cost}}"

6. CLIENT STORES RESULT
   ├─ Save message to SQLite
   ├─ Save LLM response
   ├─ Cache ERP results
   ├─ Update Zustand store
   └─ Display to user

7. CLEANUP
   ├─ LLM client removed from ephemeral pool (TTL)
   ├─ JWE credentials garbage collected
   └─ No data persisted on server
```

---

## Security Architecture

### Threat Model & Mitigations

| Threat                   | Impact                  | Mitigation                    |
| ------------------------ | ----------------------- | ----------------------------- |
| **Man-in-the-Middle**    | Credentials stolen      | TLS 1.3, pinning on mobile    |
| **Server Compromise**    | Data exposed            | Zero-storage, JWE encryption  |
| **Client Malware**       | Local data stolen       | SecureStore (hardware-backed) |
| **Prompt Injection**     | LLM misused             | Input validation, sandboxing  |
| **Credential Leakage**   | API abuse               | JWE, ephemeral pools          |
| **SSRF Attack**          | Internal network access | URL validation, IP blocking   |
| **Rate Limiting Bypass** | DoS                     | Redis + in-memory fallback    |

---

### Authentication Flow

```
1. User requests login
   → Opens browser to OAuth provider

2. Provider callback
   → Auth code exchanged for JWT

3. JWT contains:
   {
     "sub": "user_id",
     "iat": 1707590000,
     "exp": 1707593600,
     "provider": "replit",
     "roles": ["user"]
   }

4. Client stores JWT in SecureStore
   → Included in Authorization header

5. Refresh Token:
   → Renewed before expiry
   → Stored separately in SecureStore
```

---

## Scalability

### Horizontal Scaling

Because of **zero-storage** design:

- Add new servers without coordination
- No shared state (no session affinity needed)
- Use load balancer (round-robin)
- Each server is stateless

```
┌──────────────────────────────┐
│    Load Balancer (nginx)     │
└──────────────────────────────┘
        │        │        │
        ▼        ▼        ▼
    ┌────────────────────────┐
    │ NestJS Instance 1      │
    │ NestJS Instance 2      │
    │ NestJS Instance 3      │
    └────────────────────────┘
```

### Database Scalability

```
PostgreSQL
├─ Read replicas for RAG/document search
├─ Connection pooling (PgBouncer)
└─ Sharding by user_id (optional)
```

### Vector Database Scaling

```
Qdrant Cluster
├─ Replicated storage
├─ Multiple shards
└─ Auto-rebalancing
```

---

## Design Patterns

### 1. Adapter Pattern (ERP Integration)

```typescript
// Abstract interface
interface ErpAdapter {
  getDocuments(filters: any): Promise<Document[]>;
  createDocument(doc: Document): Promise<CreateResponse>;
  updateDocument(id: string, doc: Partial<Document>): Promise<void>;
}

// Concrete implementations
class OdataAdapter implements ErpAdapter { ... }
class SapAdapter implements ErpAdapter { ... }
class OdooAdapter implements ErpAdapter { ... }

// Usage
const adapter = ErpFactory.create('1c', config);
const docs = await adapter.getDocuments({ type: 'invoice' });
```

### 2. Strategy Pattern (LLM Providers)

```typescript
interface LlmProvider {
  chat(messages: Message[], tools: Tool[]): Promise<Response>;
}

// Implementations: OpenAI, Groq, Ollama...
// Selection at runtime based on settings
```

### 3. Factory Pattern (Tool Generation)

```typescript
const tools = await ToolFactory.generateFromOpenApi(spec);
// Generates: get_product, create_invoice, update_stock, etc.
```

### 4. Observer Pattern (Zustand)

```typescript
const chatStore = create((set) => ({
  messages: [],
  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),
}));

// Components subscribe to store
const { messages } = chatStore();
```

### 5. Builder Pattern (Chat Request)

```typescript
const request = new ChatRequestBuilder()
  .withMessage('Hello')
  .withHistory([...])
  .withRules([...])
  .withLlmSettings({...})
  .build();
```

---

## Performance Considerations

### Client-Side Optimization

```typescript
// 1. Message Compression
const compressed = LZ.compress(conversationHistory);
// Reduce payload from 50KB to 5KB

// 2. Pagination
const lastN = conversationHistory.slice(-20); // Recent messages only

// 3. Selective Sync
if (hasNetworkConnection) {
  syncPendingOperations();
}

// 4. Local Caching
const cachedInventory = localStore.inventory;
// Fallback if network fails
```

### Server-Side Optimization

```typescript
// 1. LLM Model Selection
// Use faster models for simple queries
if (intent === "simple_lookup") {
  model = "gpt-4o-mini"; // Cheaper, faster
} else {
  model = "gpt-4o"; // Full capability
}

// 2. Streaming (don't wait for full response)
// Return chunks as they arrive from LLM

// 3. Caching ERP Metadata
// Cache OpenAPI specs (TTL: 1 day)

// 4. Confidence-based shortcuts
// If confidence > 0.95, skip verification
```

---

## Future Enhancements

### Planned (v2.0)

- [ ] Multi-language support (currently: en, ru, de)
- [ ] Fine-tuned models per ERP system
- [ ] Advanced RAG (re-ranking, query expansion)
- [ ] Audit logging for compliance (SOX, HIPAA)
- [ ] A/B testing framework
- [ ] Custom LLM fine-tuning

### Experimental

- [ ] Agent autonomy (scheduled tasks)
- [ ] Multi-turn planning
- [ ] Function composition (meta-skills)
- [ ] Real-time collaboration

---

## References

### Related Documents

- [API Reference](./API-REFERENCE.md)
- [Installation & Deployment](./INSTALLATION-DEPLOYMENT.md)
- [Security Policy](../SECURITY.md)

### External Resources

- [Vercel AI SDK](https://sdk.vercel.ai)
- [NestJS Documentation](https://docs.nestjs.com)
- [React Native Best Practices](https://reactnative.dev)
- [OpenAPI Specification](https://spec.openapis.org/)
- [JWT.io](https://jwt.io)

---

**Last Updated:** 11 Feb 2025  
**Maintained by:** Axon Team
