# AXON - Voice-to-ERP AI Orchestrator

## Overview

AXON is an AI-powered mobile application that bridges unstructured input (voice commands, photos, chat) with structured ERP systems (1C:Enterprise, SAP, Odoo, MoySklad). Users speak naturally or scan documents instead of navigating complex ERP menus. The system uses LLM-powered AI agents to translate natural language into ERP API calls, with support for multiple LLM providers (OpenAI, Groq, Ollama, OpenRouter, Together AI).

The project is a monorepo with three main parts:
- **`client/`** — React Native (Expo) mobile app
- **`server/`** — NestJS backend API
- **`shared/`** — Shared types and database schema

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (client/)

- **Framework**: React Native with Expo SDK 55, TypeScript
- **Entry point**: `client/index.js` → `client/App.tsx`
- **Navigation**: React Navigation (native stack + bottom tabs) via `client/navigation/`
- **State management**: Zustand with persist (AsyncStorage) — stores in `client/store/` (authStore, chatStore, settingsStore, inventoryStore, loadingStore, spendingStore)
- **Data fetching**: TanStack React Query (`@tanstack/react-query`) with a custom query client in `client/lib/query-client`
- **UI components**: Custom components in `client/components/` (no Tamagui despite being in dependencies — the app uses custom themed components with `useTheme` hook)
- **Animations**: React Native Reanimated + Lottie for agent visualizer
- **Theming**: Dark/light/system themes defined in `client/constants/theme.ts`, accessed via `useTheme()` hook
- **Internationalization**: Custom i18n system in `client/i18n/translations.ts` with `useTranslation()` hook
- **Voice**: expo-audio for recording, sent to backend for Whisper transcription (`client/hooks/useVoice.ts`)
- **Security**: Biometric auth (`useBiometricAuth`), screen capture protection (`useProtectScreen`), secure storage via expo-secure-store
- **Path alias**: `@/` maps to `client/`, `@shared/` maps to `shared/`

### Backend (server/)

- **Framework**: NestJS 11 with TypeScript
- **Entry point**: `server/src/main.ts`
- **TypeScript config**: Separate `server/tsconfig.json` with CommonJS module, decorators enabled
- **Runtime**: `tsx` for development, compiled with `tsc` for production
- **Key modules** (under `server/src/`):
  - AI/LLM integration (Vercel AI SDK + OpenAI)
  - Auth (Replit OIDC + JWT session)
  - ERP connector (1C OData, universal OpenAPI/Swagger adapter)
  - RAG (Qdrant vector search for document retrieval)
  - MCP (Model Context Protocol) support
- **API**: RESTful, Swagger docs via `@nestjs/swagger`
- **Validation**: class-validator + class-transformer
- **Caching**: NestJS cache-manager

### Database

- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema**: `shared/schema.ts` — defines `users`, `sessions`, `documents` tables (and likely more)
- **Migrations**: Output to `./migrations/` directory
- **Config**: `drizzle.config.ts` requires `DATABASE_URL` environment variable
- **Push command**: `npm run db:push` (drizzle-kit push)

### Shared Code (shared/)

- `shared/schema.ts` — Drizzle database schema with Zod validation (drizzle-zod)
- `shared/types.ts` — TypeScript types for ChatMessage, Conversation, ToolCall, Attachment
- Shared between client and server for type safety

### AI & LLM Architecture

- **BYO-LLM pattern**: Users configure their own LLM provider (Base URL, API Key, Model) in settings
- **Vercel AI SDK** (`ai` package) for streaming LLM responses
- **OpenAI SDK** (`@ai-sdk/openai`) as primary provider, but any OpenAI-compatible API works
- **Function Calling / Tools**: LLM maps user intents to ERP API calls; tools are dynamically generated from OpenAPI/Swagger specs
- **MCP Support**: `@modelcontextprotocol/sdk` for connecting external tool servers

### Authentication

- **Provider**: Replit Auth via OpenID Connect (OIDC)
- **OIDC Endpoints**: `https://replit.com/auth/authorize` (authorize), `https://replit.com/auth/token` (token exchange), `https://replit.com/auth/userinfo`
- **Client ID**: Uses `REPLIT_AUTH_CLIENT_ID` env var, falls back to `REPL_ID`
- **Flow**: Server-driven OAuth2 Authorization Code flow
  1. Client opens WebBrowser to `GET /api/auth/login?redirect=axon://auth/callback`
  2. Server redirects to `replit.com/auth/authorize` with OIDC params
  3. User authenticates on Replit
  4. Replit redirects to `GET /api/auth/callback?code=...&state=...`
  5. Server exchanges code for tokens at `replit.com/auth/token`
  6. Server generates temp auth code, redirects to app deep link `axon://auth/callback?code=tempCode`
  7. Client exchanges temp code via `POST /api/auth/exchange` for JWT session
- **Deep link scheme**: `axon://` (configured in `app.json`)
- **Dev login**: `POST /api/auth/dev-login` available in development mode
- **Client-side**: Auth state managed in `client/store/authStore.ts`, login in `client/screens/LoginScreen.tsx`
- **Server-side**: `server/src/modules/auth/auth.service.ts` (OIDC logic), `server/src/modules/auth/auth.controller.ts` (routes)
- **Port architecture**: External domain routes to Expo (port 8081), API accessible at `DOMAIN:5000`

### SSE / Streaming Architecture

- **Pattern**: Server buffers full SSE response, client reads with `response.text()` then parses SSE lines
- **Reason**: React Native on iOS/Android does not support `ReadableStream.getReader()` — only works on web
- **Affected files**: `useAxon.ts`, `useVoice.ts`, `useVoiceStream.ts`, `ChatScreen.tsx`
- **Format**: Lines prefixed with `data: ` containing JSON objects with `type`/`content`/`done` fields

### Key Scripts

| Script | Purpose |
|--------|---------|
| `npm run expo:dev` | Start Expo dev server (Replit) |
| `npm run server:dev` | Start NestJS server in dev mode |
| `npm run db:push` | Push Drizzle schema to database |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Jest tests |
| `npm run check:types` | TypeScript type checking |

### Testing

- **Framework**: Jest with jest-expo preset
- **Config**: `jest.config.js` with extensive mocks in `jest.setup.js`
- **Path mapping**: Same `@/` and `@shared/` aliases
- **Coverage**: Focused on `client/lib/logger.ts` and `server/src/utils/logger.ts`

### Web Landing Page

- `web/index.html` — Static landing page for the app (not the React Native web target)
- Styled with design guidelines dark theme

## External Dependencies

### Cloud Services
- **Supabase**: Authentication (Phone OTP), user management, JWT tokens
- **Qdrant**: Vector database for RAG (document embeddings and semantic search)
- **PostgreSQL**: Primary relational database (via DATABASE_URL env var, used with Drizzle ORM)

### AI/LLM Providers (BYO-LLM — user-configurable)
- **OpenAI**: GPT-4o, Whisper (speech-to-text), embeddings
- **Groq**: LPU inference (OpenAI-compatible)
- **Ollama**: Local/self-hosted models
- **OpenRouter**: Multi-model routing
- **Together AI**: Open-source model hosting

### ERP Integrations (via Universal Adapter)
- **1C:Enterprise**: OData/HTTP API
- **SAP**: REST API
- **Odoo**: REST/JSON-RPC API
- **MoySklad**: REST API

### Key NPM Packages
- `expo` (SDK 55) — Mobile app framework
- `@nestjs/*` — Backend framework
- `drizzle-orm` + `drizzle-zod` — Database ORM with validation
- `ai` + `@ai-sdk/openai` — Vercel AI SDK for LLM streaming
- `@modelcontextprotocol/sdk` — MCP protocol support
- `@supabase/supabase-js` — Auth client
- `@tanstack/react-query` — Data fetching/caching
- `zustand` — Client state management
- `react-native-reanimated` — Animations
- `expo-audio` — Voice recording
- `expo-camera` — Document/barcode scanning
- `bcryptjs` — Password hashing
- `zod` — Schema validation

### Environment Variables Required
- `DATABASE_URL` — PostgreSQL connection string
- OpenAI/LLM API keys (user-configurable)
- Supabase URL and keys
- Qdrant connection details
- 1C/ERP endpoint URLs and credentials