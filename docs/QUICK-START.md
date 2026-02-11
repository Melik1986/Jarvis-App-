# Developer Quick Start Guide

**Version:** 1.0.0  
**Time to First Run:** 15 minutes  
**Last Updated:** 11 Feb 2025

---

## TL;DR - 5 Minutes Setup

### Clone & Install

```bash
git clone https://github.com/Melik1986/Axon-App.git
cd Axon-App
npm install
cp .env.example .env
```

### Configure `.env`

```bash
# Minimal config to run locally
EXPO_PUBLIC_DOMAIN=http://localhost:5000
NODE_ENV=development
JWT_SECRET=dev_secret_key_1234567890
DATABASE_URL=postgresql://postgres:password@localhost:5432/axon_dev
OPENAI_API_KEY=sk-your-key-here
```

### Start Backend

```bash
npm run server:dev
# Server runs on http://localhost:5000
# API Docs: http://localhost:5000/api/docs
```

### Start Frontend (New Terminal)

```bash
npm start
# Press 'i' for iOS simulator or 'a' for Android
# Or scan QR code with Expo Go app
```

---

## Directory Structure

```
Axon-App/
├── client/                 # React Native (Expo)
│   ├── screens/           # App screens
│   ├── components/        # UI components
│   ├── hooks/             # Custom React hooks
│   ├── store/             # Zustand state management
│   ├── lib/               # Utilities (api, crypto, storage)
│   └── i18n/              # Internationalization
│
├── server/                # NestJS backend
│   └── src/
│       ├── modules/       # Feature modules
│       │   ├── auth/      # Authentication
│       │   ├── chat/      # AI chat
│       │   ├── erp/       # ERP integrations
│       │   ├── llm/       # LLM providers
│       │   ├── rag/       # Knowledge base
│       │   ├── rules/     # Business rules
│       │   ├── skills/    # Custom skills
│       │   └── mcp/       # MCP integration
│       ├── guards/        # Auth & rate limiting
│       ├── filters/       # Exception handling
│       └── main.ts        # App entry point
│
├── shared/                # Shared types & schema
│   ├── schema.ts         # Drizzle ORM schema
│   └── types.ts          # TypeScript interfaces
│
├── docs/                  # Documentation
│   ├── API-REFERENCE.md
│   ├── ARCHITECTURE.md
│   ├── INSTALLATION-DEPLOYMENT.md
│   ├── DATABASE-SCHEMA.md
│   └── INTEGRATION-GUIDES.md
│
└── package.json           # Dependencies & scripts
```

---

## Core Concepts (60 Seconds)

### Zero-Storage

- **Server doesn't store state** — only processes requests
- **Client sends everything** — message, history, rules, settings
- **Why?** Privacy, scalability, GDPR compliance

### Offline-First

- **Works without internet** — SQLite local cache
- **Syncs when online** — React Query handles it
- **Graceful degradation** — shows cached data if API fails

### Zero-Knowledge Privacy

- **Credentials encrypted (JWE)** before sending to server
- **Server forgets immediately** — ephemeral client pools
- **Hardware-backed storage** — Keychain/Secure Enclave on mobile

### Conductor Pattern

- **Client = Conductor** — decides what to do
- **Server = Executor** — runs commands, returns results
- **Example:** Client encrypts ERP credentials → Server uses them → Deletes from memory

---

## Common Tasks

### 1. Start Development Server

```bash
npm run server:dev
```

**What it does:**

- Compiles TypeScript
- Watches for changes
- Starts NestJS on port 5000
- Enables Swagger at `/api/docs`

**Endpoints:**

- `POST /api/auth/login` — OAuth login
- `POST /api/chat` — AI chat (SSE streaming)
- `GET /api/health` — Health check

---

### 2. Test API Endpoint Locally

```bash
# Get access token first
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"provider": "replit"}'

# Use token to call chat endpoint
curl -X POST http://localhost:5000/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello",
    "conversationHistory": [],
    "llmSettings": {"provider": "openai", "model": "gpt-4o"}
  }'
```

---

### 3. Debug Mobile App

**iOS:**

```bash
npm start
# Press 'i' to open Xcode simulator
# Use Debug → Open JS Debugger
```

**Android:**

```bash
npm start
# Press 'a' to open Android emulator
# Shake device (or Cmd+M) → Debug Remote JS
```

**Or use React Native Debugger:**

```bash
# Install standalone debugger
# Menu → Debugger → Connect to device
```

---

### 4. Add New ERP Provider

**Example: Adding SAP connector**

1. Create adapter:

```bash
touch server/src/modules/erp/adapters/sap.adapter.ts
```

2. Implement interface:

```typescript
export class SapAdapter implements ErpAdapter {
  async getDocuments() { ... }
  async createDocument() { ... }
}
```

3. Register in factory:

```typescript
// server/src/modules/erp/erp.adapter-factory.ts
case 'sap':
  return new SapAdapter(config);
```

4. Test:

```bash
npm run test -- sap.adapter.test.ts
```

See [Integration Guides](./INTEGRATION-GUIDES.md) for details.

---

### 5. Add New LLM Provider

**Example: Adding Claude support**

1. Create provider:

```bash
touch server/src/modules/llm/providers/anthropic.provider.ts
```

2. Implement streaming:

```typescript
export class AnthropicProvider {
  async streamChat(messages, tools) { ... }
}
```

3. Register:

```typescript
// server/src/modules/llm/llm.provider-factory.ts
case 'anthropic':
  return new AnthropicProvider(config);
```

See [Integration Guides](./INTEGRATION-GUIDES.md) for full example.

---

### 6. Create Custom Rule

**Via Mobile App:**

1. Settings → Rules Management
2. Click "New Rule"
3. Define: Condition + Actions
4. Example: "If quantity < 0, reject"

**Programmatically:**

```typescript
// client/store/rulesStore.ts
rulesStore.addRule({
  name: "Minimum Order Quantity",
  condition: "quantity >= 5",
  actions: [{ type: "validate", message: "Min 5 units required" }],
});
```

---

### 7. Run Tests

```bash
# All tests
npm test

# Backend only
npm run test:server

# Watch mode
npm test -- --watch

# Coverage
npm test -- --coverage
```

---

### 8. Code Quality Checks

```bash
# Lint
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type checking
npm run check:types
```

---

### 9. Database Migrations

```bash
# View schema
cat shared/schema.ts

# After schema change, generate migration:
npx drizzle-kit generate

# Apply to database:
npm run db:push
```

---

### 10. Environment Variables Reference

| Variable             | Purpose               | Example                          |
| -------------------- | --------------------- | -------------------------------- |
| `NODE_ENV`           | Runtime environment   | `development` \| `production`    |
| `DATABASE_URL`       | PostgreSQL connection | `postgresql://user:pass@host/db` |
| `JWT_SECRET`         | Token signing key     | `min_32_char_random_string`      |
| `OPENAI_API_KEY`     | LLM credentials       | `sk-...`                         |
| `EXPO_PUBLIC_DOMAIN` | Backend URL           | `http://localhost:5000`          |

Full list → [INSTALLATION-DEPLOYMENT.md](./INSTALLATION-DEPLOYMENT.md#environment-configuration)

---

## Common Issues & Fixes

### **"Cannot find module" Error**

```
Error: Cannot find module '@nestjs/common'
```

**Fix:**

```bash
npm install
npm run check:types
```

---

### **Port 5000 Already in Use**

```bash
# Find process using port 5000
lsof -i :5000

# Kill it
kill -9 <PID>

# Or use different port
PORT=5001 npm run server:dev
```

---

### **Database Connection Failed**

```
Error: ECONNREFUSED 127.0.0.1:5432
```

**Fix:**

```bash
# Start PostgreSQL (macOS)
brew services start postgresql@16

# Or with Docker
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16

# Verify connection
psql postgresql://postgres:postgres@localhost/postgres
```

---

### **Expo App Blank Screen**

```bash
# Clear cache
rm -rf .expo node_modules
npm install

# Reset Metro bundler
npm start -- --reset-cache
```

---

### **"Invalid JWT" Error**

```
Unauthorized: JWT malformed
```

**Fix:**

1. Check `JWT_SECRET` matches in `.env`
2. Regenerate token (logout → login)
3. Verify token format: `Bearer <token>`

---

### **LLM API Error 401**

```
Error: Invalid API key
```

**Fix:**

```bash
# Verify API key in .env
echo $OPENAI_API_KEY

# Test API key:
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# If invalid, get new key from:
# https://platform.openai.com/api-keys
```

---

## Architecture Cheat Sheet

### Request Flow

```
User Voice Input
       ↓
Client: Transcribe (Whisper)
       ↓
Client: Load history, rules, skills
       ↓
Client: Encrypt credentials (JWE)
       ↓
Client: POST /api/chat with full state
       ↓
Server: Decrypt credentials (ephemeral)
       ↓
Server: Call LLM with tools
       ↓
Server: Execute tool (call ERP)
       ↓
Server: Stream response (SSE)
       ↓
Client: Save to SQLite
       ↓
Display to User
```

---

### Tool Calling Flow

```
User: "Create invoice for customer #123"
       ↓
LLM returns: {
  "type": "function_call",
  "function": {
    "name": "create_invoice",
    "arguments": {"customerId": "123", "items": [...]}
  }
}
       ↓
Guardian Guard checks rules
       ↓
If valid: Execute ERP API
       ↓
Stream tool result back to client
       ↓
LLM may call more tools or finish
```

---

## File You'll Edit Often

| File                                      | Purpose         | When             |
| ----------------------------------------- | --------------- | ---------------- |
| `.env`                                    | Config          | Add LLM/ERP keys |
| `server/src/modules/chat/chat.service.ts` | AI logic        | Modify prompts   |
| `client/screens/ChatScreen.tsx`           | UI              | Change layout    |
| `shared/schema.ts`                        | Database        | Add fields       |
| `server/src/modules/erp/adapters/`        | ERP integration | Add provider     |

---

## Documentation Map

```
📖 START HERE
    ↓
README.md (5 min overview)
    ↓
├─ Quick Start (this file) ← You are here
├─ API-REFERENCE.md (REST endpoints)
├─ ARCHITECTURE.md (system design)
├─ DATABASE-SCHEMA.md (storage layer)
├─ INSTALLATION-DEPLOYMENT.md (production setup)
└─ INTEGRATION-GUIDES.md (extend system)
```

---

## Next Steps

### Beginner

1. ✅ Run `npm install && npm run server:dev`
2. ✅ Start mobile app with `npm start`
3. ✅ Read [ARCHITECTURE.md](./ARCHITECTURE.md) (30 min)
4. ✅ Make first API call to `/api/health`

### Intermediate

1. ✅ Add new ERP provider (see [INTEGRATION-GUIDES.md](./INTEGRATION-GUIDES.md))
2. ✅ Create custom rule via UI
3. ✅ Write unit tests for your changes
4. ✅ Run `npm run lint:fix && npm run format`

### Advanced

1. ✅ Optimize chat streaming performance
2. ✅ Implement custom RAG provider
3. ✅ Create MCP server for external integration
4. ✅ Set up production deployment

---

## Support & Resources

### Community

- **GitHub Issues:** https://github.com/Melik1986/Axon-App/issues
- **Discussions:** https://github.com/Melik1986/Axon-App/discussions

### Documentation

- [Vercel AI SDK](https://sdk.vercel.ai)
- [NestJS Docs](https://docs.nestjs.com)
- [React Native](https://reactnative.dev)
- [Expo Docs](https://docs.expo.dev)

### External APIs

- [OpenAI](https://platform.openai.com/docs)
- [Groq](https://console.groq.com)
- [Qdrant](https://qdrant.tech/documentation/)

---

## Tips & Tricks

### 🚀 Speed Up Development

```bash
# Install watchman (faster file watching)
brew install watchman

# Use Turbo for faster builds (npm 7+)
npm install -g turbo

# Clear all caches at once
npm run clean-all
```

### 🐛 Debug Streaming Responses

```bash
# In client code
const chatStream = fetch('/api/chat', {...});
chatStream.body.getReader().read() // Stream events
  .then(({done, value}) => {
    const text = new TextDecoder().decode(value);
    console.log(text); // See raw SSE events
  });
```

### 📦 Check Bundle Size

```bash
npm run build
# Check server/dist/ or client/dist/ size
du -sh server/dist/
```

### 🔍 Network Inspection

```bash
# On Android: Android Studio → Logcat
# On iOS: Xcode → Console
# Or use Charles Proxy / Burp Suite
```

---

## Pre-commit Checklist

Before pushing code:

```bash
# 1. Run tests
npm test

# 2. Type check
npm run check:types

# 3. Lint & format
npm run lint:fix && npm run format

# 4. Build
npm run server:nest:build

# 5. Run locally
npm run server:dev &
npm start
```

---

**Ready to code?** Start with `npm install && npm run server:dev`! 🚀

---

**Last Updated:** 11 Feb 2025  
**Maintained by:** Axon Team
