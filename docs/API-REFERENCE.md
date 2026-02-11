# AXON API Reference

**Version:** 1.0.0  
**Base URL:** `https://{EXPO_PUBLIC_DOMAIN}/api`  
**Authentication:** JWT Bearer Token (see [Authentication](#authentication))

---

## Table of Contents

1. [Authentication](#authentication)
2. [Chat API](#chat-api)
3. [Voice API](#voice-api)
4. [Rules API](#rules-api)
5. [Skills API](#skills-api)
6. [RAG API](#rag-api)
7. [MCP API](#mcp-api)
8. [Conductor API](#conductor-api)
9. [Error Handling](#error-handling)

---

## Authentication

### OAuth / OIDC Login

Supports multiple auth providers: **Replit Auth**, **OIDC**, **JWT**.

#### `POST /auth/login`

Initiates OAuth flow.

**Request:**

```json
{
  "provider": "replit",
  "redirectUrl": "exp://localhost:19000/home"
}
```

**Response:**

```json
{
  "authorizationUrl": "https://replit.com/oauth/authorize?...",
  "codeVerifier": "..."
}
```

**Status Codes:**

- `200` - Authorization URL generated
- `400` - Invalid provider or redirect URL

---

#### `POST /auth/callback`

Exchanges authorization code for JWT token.

**Request:**

```json
{
  "code": "authorization_code_here",
  "codeVerifier": "code_verifier_here",
  "provider": "replit"
}
```

**Response:**

```json
{
  "accessToken": "<access_token_string>",
  "refreshToken": "<refresh_token_string>",
  "expiresIn": 3600,
  "user": {
    "id": "user_123",
    "username": "john_doe",
    "email": "john@example.com"
  }
}
```

**Status Codes:**

- `200` - Token issued
- `400` - Invalid code or expired verifier
- `401` - OAuth provider rejected

---

#### `POST /auth/refresh`

Refreshes expired access token.

**Headers:**

```
Authorization: Bearer <your_refresh_token>
```

**Response:**

```json
{
  "accessToken": "<access_token_string>",
  "expiresIn": 3600
}
```

**Status Codes:**

- `200` - New token issued
- `401` - Refresh token invalid or expired

---

### Bearer Token Usage

All endpoints (except `/auth/login`, `/auth/callback`) require JWT in `Authorization` header:

```
Authorization: Bearer {your_access_token_here}
```

---

## Chat API

### Stateless Chat with Streaming

**Zero-Storage Design:** Client sends message, history, rules, skills, and LLM settings in one request. Server processes and streams response without storing state.

#### `POST /chat`

Stream AI response via SSE (Server-Sent Events).

**Headers:**

```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**

```json
{
  "message": "What's the stock of product #42?",
  "conversationHistory": [
    {
      "id": "msg_1",
      "role": "user",
      "content": "Show me all products",
      "timestamp": "2025-02-11T10:00:00Z"
    },
    {
      "id": "msg_2",
      "role": "assistant",
      "content": "Found 15 products in inventory.",
      "timestamp": "2025-02-11T10:00:05Z"
    }
  ],
  "rules": [
    {
      "id": "rule_1",
      "name": "Stock Check Before Create",
      "condition": "operation == 'create_invoice'",
      "actions": ["verify_stock"]
    }
  ],
  "skills": [
    {
      "id": "skill_1",
      "name": "Custom Validator",
      "type": "javascript",
      "content": "module.exports = async (data) => { return data.quantity > 0; };"
    }
  ],
  "llmSettings": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7,
    "maxTokens": 2000,
    "systemPrompt": "You are a helpful ERP assistant..."
  },
  "erpSettings": {
    "provider": "1c",
    "baseUrl": "https://erp.company.com",
    "apiKey": "jwe:..." // JWE-encrypted credentials
  },
  "ragSettings": {
    "provider": "qdrant",
    "enabled": true,
    "topK": 5
  }
}
```

**Response (SSE Stream):**

```
data: {"type":"text_chunk","content":"Let me check"}
data: {"type":"tool_call","toolName":"get_stock","arguments":{"productId":42}}
data: {"type":"tool_result","toolName":"get_stock","result":{"quantity":120,"unit":"pieces"}}
data: {"type":"text_chunk","content":" the current stock."}
data: {"type":"done","metadata":{"inputTokens":150,"outputTokens":45,"cost":0.0012}}
```

**Stream Event Types:**

| Type               | Description                    | Properties                                              |
| ------------------ | ------------------------------ | ------------------------------------------------------- |
| `text_chunk`       | Partial text response          | `content: string`                                       |
| `tool_call`        | Function call to ERP/RAG       | `toolName: string`, `arguments: object`                 |
| `tool_result`      | Result from tool execution     | `toolName: string`, `result: object \| error: string`   |
| `confidence_score` | AI confidence in response      | `score: number (0-1)`, `reason: string`                 |
| `diff_preview`     | Changes preview (before/after) | `toolName: string`, `before: object`, `after: object`   |
| `done`             | Stream complete                | `metadata: {inputTokens, outputTokens, cost, duration}` |

**Status Codes:**

- `200` - SSE stream starts
- `400` - Invalid request body
- `429` - Rate limit exceeded
- `502` - LLM provider error

**Example (cURL):**

```bash
curl -X POST https://api.example.com/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Show stock",
    "conversationHistory": [],
    "rules": [],
    "skills": [],
    "llmSettings": {"provider": "openai", "model": "gpt-4o"}
  }'
```

---

## Voice API

### Transcribe Audio and Process Voice Command

#### `POST /voice/transcribe`

Upload audio file, transcribe with Whisper, optionally execute as command.

**Headers:**

```
Authorization: Bearer {token}
```

**Request (multipart/form-data):**

```
POST /voice/transcribe
Authorization: Bearer {token}

--boundary
Content-Disposition: form-data; name="audio"; filename="command.wav"
Content-Type: audio/wav
[binary audio data]

--boundary
Content-Disposition: form-data; name="llmSettings"
{"provider": "openai", "model": "gpt-4o"}

--boundary
Content-Disposition: form-data; name="executeCommand"
true
--boundary--
```

**Response:**

```json
{
  "transcription": "What is the current stock level",
  "confidence": 0.95,
  "language": "en",
  "chatStreamUrl": "https://api.example.com/chat/stream/abc123"
}
```

**Status Codes:**

- `200` - Transcription successful
- `400` - No audio file provided
- `413` - Audio file too large (max 25MB)
- `422` - Audio format not supported

---

## Rules API

### Manage Business Rules

Rules are business validation logic stored locally on the client. Server provides CRUD endpoints for rules management.

#### `GET /rules`

Retrieve all rules for current user.

**Response:**

```json
{
  "data": [
    {
      "id": "rule_1",
      "name": "Minimum Order Quantity",
      "description": "All orders must have qty >= 5",
      "enabled": true,
      "condition": "operation == 'create_order'",
      "actions": [
        {
          "type": "validate",
          "field": "quantity",
          "operator": ">=",
          "value": 5,
          "errorMessage": "Minimum order quantity is 5 units"
        }
      ],
      "createdAt": "2025-01-15T10:00:00Z",
      "updatedAt": "2025-02-11T14:30:00Z"
    }
  ],
  "total": 1
}
```

---

#### `POST /rules`

Create new rule.

**Request:**

```json
{
  "name": "Price Validation",
  "description": "Reject orders with price > $10,000",
  "enabled": true,
  "condition": "operation == 'create_order'",
  "actions": [
    {
      "type": "validate",
      "field": "totalPrice",
      "operator": ">",
      "value": 10000,
      "action": "reject",
      "errorMessage": "Order amount exceeds limit"
    }
  ]
}
```

**Response:**

```json
{
  "id": "rule_2",
  "name": "Price Validation",
  "createdAt": "2025-02-11T15:00:00Z"
}
```

---

#### `PATCH /rules/:id`

Update rule.

**Request:**

```json
{
  "enabled": false,
  "actions": [
    {
      "type": "validate",
      "field": "totalPrice",
      "operator": ">",
      "value": 20000,
      "action": "warn"
    }
  ]
}
```

---

#### `DELETE /rules/:id`

Delete rule.

**Status Codes:**

- `204` - Deleted

---

#### `POST /rules/import`

Import rules from Markdown file.

**Request (multipart):**

```
POST /rules/import
Authorization: Bearer {token}

--boundary
Content-Disposition: form-data; name="file"; filename="rules.md"
Content-Type: text/markdown

# Company Rules

## Rule 1: Stock Check
- Operation: create_invoice
- Validate: quantity > available_stock
- Action: reject

--boundary--
```

**Response:**

```json
{
  "imported": 2,
  "failed": 0,
  "results": [{ "name": "Stock Check", "status": "success" }]
}
```

---

## Skills API

### Manage Custom Skills

Skills are JavaScript functions or Markdown documentation stored locally. Server provides management endpoints.

#### `GET /skills`

List all skills.

**Response:**

```json
{
  "data": [
    {
      "id": "skill_1",
      "name": "Calculate Discount",
      "description": "Compute discount percentage",
      "type": "javascript",
      "content": "module.exports = async (price, percent) => { return price * (1 - percent / 100); };",
      "enabled": true,
      "tags": ["pricing", "math"],
      "createdAt": "2025-01-20T10:00:00Z"
    }
  ]
}
```

---

#### `POST /skills`

Create new skill.

**Request:**

```json
{
  "name": "VAT Calculator",
  "description": "Calculate VAT for different regions",
  "type": "javascript",
  "content": "module.exports = async (amount, region) => { const rates = {de: 0.19, fr: 0.20}; return amount * rates[region]; };",
  "tags": ["tax", "eu"]
}
```

---

#### `POST /skills/sandbox-execute`

Test execute skill in isolated sandbox.

**Request:**

```json
{
  "skillId": "skill_1",
  "arguments": [100, 0.1]
}
```

**Response:**

```json
{
  "result": 90,
  "executionTime": 12,
  "error": null
}
```

---

#### `POST /skills/import`

Import skill from file (JavaScript or Markdown).

**Request (multipart):**

```
POST /skills/import
Authorization: Bearer {token}

--boundary
Content-Disposition: form-data; name="file"; filename="my-skill.js"
Content-Type: application/javascript

module.exports = async (data) => {
  // Your custom logic
  return data.processed;
};

--boundary--
```

---

## RAG API

### Retrieve Augmented Generation Knowledge Base

#### `POST /rag/search`

Search knowledge base using vector similarity.

**Request:**

```json
{
  "query": "How to process a customer return?",
  "topK": 5,
  "provider": "qdrant",
  "filters": {
    "department": "sales",
    "minRelevance": 0.7
  }
}
```

**Response:**

```json
{
  "results": [
    {
      "id": "doc_1",
      "title": "Return Policy §3.2",
      "content": "Customers may return goods within 30 days...",
      "similarity": 0.92,
      "source": "company_handbook.pdf",
      "metadata": {
        "department": "sales",
        "lastUpdated": "2025-01-10",
        "authority": "CEO"
      }
    }
  ],
  "searchTime": 145
}
```

---

#### `POST /rag/ingest`

Upload document for RAG indexing.

**Request (multipart):**

```
POST /rag/ingest
Authorization: Bearer {token}
Content-Type: multipart/form-data

--boundary
Content-Disposition: form-data; name="file"; filename="handbook.pdf"
Content-Type: application/pdf
[binary PDF data]

--boundary
Content-Disposition: form-data; name="metadata"
{"department": "operations", "version": "2.1"}

--boundary--
```

**Response:**

```json
{
  "documentId": "doc_42",
  "fileName": "handbook.pdf",
  "chunks": 15,
  "tokensUsed": 3420,
  "status": "indexed"
}
```

---

#### `GET /rag/documents`

List ingested documents.

**Response:**

```json
{
  "data": [
    {
      "id": "doc_1",
      "fileName": "company_handbook.pdf",
      "uploadedAt": "2025-01-10T09:00:00Z",
      "chunks": 12,
      "status": "indexed"
    }
  ],
  "total": 3
}
```

---

#### `DELETE /rag/documents/:id`

Remove document from RAG.

---

## MCP API

### Model Context Protocol Integration

#### `POST /mcp/servers/connect`

Register new MCP server.

**Request:**

```json
{
  "name": "File Operations MCP",
  "serverUrl": "http://localhost:3001",
  "capabilities": ["read_files", "write_files"],
  "trustLevel": "managed",
  "metadata": {
    "description": "Local file system operations"
  }
}
```

**Response:**

```json
{
  "serverId": "mcp_1",
  "status": "connected",
  "tools": [
    {
      "name": "read_file",
      "description": "Read file from disk",
      "parameters": {
        "filePath": { "type": "string" }
      }
    }
  ]
}
```

---

#### `GET /mcp/servers`

List connected MCP servers.

**Response:**

```json
{
  "data": [
    {
      "serverId": "mcp_1",
      "name": "File Operations",
      "status": "connected",
      "lastHealthCheck": "2025-02-11T15:30:00Z"
    }
  ]
}
```

---

#### `POST /mcp/servers/:id/disconnect`

Disconnect MCP server.

---

## Conductor API

### Conductor Pattern Testing & Tool Inspection

#### `POST /conductor/parse`

Parse user input and return available tools (for testing).

**Request:**

```json
{
  "userInput": "Create invoice for customer #123",
  "erpSettings": {
    "provider": "1c",
    "baseUrl": "https://erp.company.com"
  },
  "llmSettings": {
    "provider": "openai",
    "model": "gpt-4o"
  }
}
```

**Response:**

```json
{
  "parsedIntent": "create_document",
  "tools": [
    {
      "name": "create_invoice",
      "description": "Create invoice document",
      "parameters": {
        "customerId": { "type": "string", "required": true },
        "items": { "type": "array", "items": { "type": "object" } },
        "dueDate": { "type": "string", "format": "date-time" }
      }
    },
    {
      "name": "get_customer_details",
      "description": "Fetch customer information",
      "parameters": {
        "customerId": { "type": "string", "required": true }
      }
    }
  ],
  "confidence": 0.87,
  "suggestedNextStep": "Confirm customer details"
}
```

---

## Error Handling

### Error Response Format

All errors follow this standard format:

```json
{
  "statusCode": 400,
  "errorCode": "INVALID_REQUEST",
  "message": "Invalid request payload",
  "details": {
    "field": "llmSettings.provider",
    "issue": "Provider 'claude-3' not supported. Supported: openai, groq, ollama"
  },
  "timestamp": "2025-02-11T15:30:00Z",
  "requestId": "req_abc123"
}
```

### Error Codes

| Code                       | HTTP | Description                     |
| -------------------------- | ---- | ------------------------------- |
| `INVALID_REQUEST`          | 400  | Malformed request body          |
| `UNAUTHORIZED`             | 401  | Invalid or missing JWT token    |
| `FORBIDDEN`                | 403  | User lacks permission           |
| `NOT_FOUND`                | 404  | Resource not found              |
| `RATE_LIMIT_EXCEEDED`      | 429  | Too many requests               |
| `LLM_PROVIDER_ERROR`       | 502  | OpenAI/Groq/Ollama unavailable  |
| `ERP_CONNECTION_ERROR`     | 503  | ERP system unreachable          |
| `RAG_INDEXING_ERROR`       | 500  | Vector store error              |
| `INVALID_JWE`              | 400  | JWE decryption failed           |
| `TOOL_EXECUTION_FAILED`    | 400  | ERP tool call failed            |
| `GUARDIAN_GUARD_VIOLATION` | 403  | Pre-execution validation failed |

---

### Rate Limiting

All endpoints are rate-limited per user:

**Per-user limit:** 100 requests/minute  
**Global limit:** 1000 requests/minute

When limit exceeded:

```json
{
  "statusCode": 429,
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "message": "Rate limit exceeded. Retry-After: 45 seconds",
  "retryAfter": 45
}
```

Response headers include:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1707580200
Retry-After: 45
```

---

## Example Workflows

### Workflow 1: Voice Command → Chat Stream

```
1. User says: "Show me all pending invoices"
2. Client calls POST /voice/transcribe with audio
3. Server returns transcription: "Show me all pending invoices"
4. Client calls POST /chat with message + history + ERP settings
5. Server streams:
   - text_chunk: "Let me retrieve pending invoices"
   - tool_call: "get_documents" with {status: "pending", type: "invoice"}
   - tool_result: [...3 invoices...]
   - text_chunk: "Found 3 pending invoices..."
   - done
```

### Workflow 2: Rule-Based Validation

```
1. User: "Create purchase order for $50,000"
2. Client sends to /chat with rules
3. Server AI returns tool_call: "create_order" with {amount: 50000}
4. Guardian Guard checks against rule: "amount > 10000 → require_confirmation"
5. Server streams: {"type": "require_confirmation", "reason": "..."}
6. Client prompts user
7. Client resubmits with "userConfirmed": true
8. Order created
```

---

## SDK / Client Examples

### JavaScript (Fetch)

```javascript
// Subscribe to chat stream
const response = await fetch("https://api.example.com/api/chat", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    message: "Show stock",
    conversationHistory: [],
    rules: [],
    skills: [],
    llmSettings: { provider: "openai", model: "gpt-4o" },
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const text = decoder.decode(value);
  const events = text.split("\n");

  for (const event of events) {
    if (event.startsWith("data: ")) {
      const json = JSON.parse(event.slice(6));
      console.log(json);
    }
  }
}
```

### React Native (Expo)

```typescript
import { fetch as expoFetch } from "expo-fetch";

const chatStream = async (message: string) => {
  const response = await expoFetch("https://api.example.com/api/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      conversationHistory: [],
      llmSettings: { provider: "openai" },
    }),
  });

  // Process SSE stream
  const reader = response.body.getReader();
  // ...
};
```

---

## Swagger Documentation

Full OpenAPI specification available at: `/api/docs`

---

**Last Updated:** 11 Feb 2025  
**Maintained by:** Axon Team
