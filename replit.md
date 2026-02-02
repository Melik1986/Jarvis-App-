# 🧠 AXON: Universal AI ERP OS

**Replit Mobile Buildathon Edition**

> **One Codebase, Infinite Possibilities.**
> Built on the **Replit Native Stack**: React Native (Expo) + Nest.js + PostgreSQL + OpenAI.

---

## 📖 Overview

**AXON** is a game-changing AI agent that bridges the gap between complex ERP systems (like SAP, Odoo, Microsoft Dynamics) and the people who use them.

Instead of navigating through endless menus, users can simply:

- 🗣️ **Speak**: "Order 50 more units of Coffee Beans."
- 📸 **Show**: Snap a photo of an invoice to auto-create a receipt.
- 💬 **Chat**: Ask "What is our current revenue?" and get an instant, data-backed answer.

We leverage the **AI Adapter Pattern** to translate natural language into structured API calls using OpenAPI specifications, making enterprise software accessible to everyone.

---

## 🏗️ System Architecture

Our architecture is designed for speed, scalability, and "Write Once, Run Everywhere" capability.

### 📱 Frontend (Mobile & Web)

- **Core**: [Expo SDK 54](https://expo.dev) + [React Native 0.81](https://reactnative.dev)
- **Navigation**: React Navigation v7 (Native Stack & Bottom Tabs)
- **State**: Zustand (Store) + TanStack Query (Server State)
- **UI/UX**:
  - **React Native Reanimated**: Buttery smooth 60fps animations.
  - **Blur & Glassmorphism**: Modern, high-end aesthetic.
  - **Haptics**: Tactile feedback for every interaction.
- **Local-First**: `AsyncStorage` for offline capability.

### ⚡ Backend (Server)

- **Framework**: Nest.js (TypeScript) with modular architecture
- **Runtime**: Node.js with ts-node + SWC for fast compilation
- **Database**: PostgreSQL (Replit Postgres on deploy, or any provider)
- **ORM**: Drizzle ORM (Type-safe SQL)
- **Modules**:
  - `ChatModule`: Conversation management and AI chat
  - `LlmModule`: Multi-provider LLM support (OpenAI, Anthropic, Groq, Ollama)
  - `RagModule`: RAG knowledge base with Qdrant vector store
  - `ErpModule`: ERP integration via OpenAPI adapter
  - `AuthModule`: Replit Auth (OpenID Connect) + JWT tokens
- **AI Engine**:
  - **OpenAI SDK**: GPT-4o for reasoning.
  - **Whisper**: For lightning-fast voice transcription.
  - **DALL-E 3**: For visual generation.

### 🔗 Shared Layer (The Monorepo Magic)

- Located in `/shared`.
- **Single Source of Truth**: `shared/types.ts` for isomorphic types; `shared/schema.ts` for server-only Drizzle schema.
- **Zero Desync**: API contracts are enforced at compile time.

---

## 🔌 Integration & Features

### 🧠 The AI Adapter (MCP)

We don't hardcode ERP logic. We use **Model Context Protocol (MCP)** principles:

1.  **Ingest**: Load any OpenAPI/Swagger spec (e.g., OData, SAP).
2.  **Map**: The LLM understands the API structure dynamically.
3.  **Execute**: User intent is translated into precise API calls.

### 🌍 Universal Access

- **Multi-Model Support (BYO-LLM)**: Switch between OpenAI, Anthropic (Claude), Groq, or local Ollama models.
- **Polyglot**: Full localization in 6 languages (EN, RU, DE, ES, FR, ZH).
- **Themeable**: Automatic Dark/Light mode syncing with system settings.

### 🛡️ Enterprise Ready

- **Security**: Secure storage for API keys and credentials.
- **Performance**: Optimistic updates and offline caching.
- **Scalability**: Stateless backend design ready for serverless deployment.

---

## 🛠️ Development & Deployment

### Environment Setup

The project requires the following keys in Replit Secrets or `.env`:

- `DATABASE_URL`: Connection string for PostgreSQL.
- `OPENAI_API_KEY`: For AI reasoning capabilities.
- `EXPO_PUBLIC_DOMAIN`: Public URL for the backend.

### Commands

- `npm run expo:dev`: Start the mobile development server.
- `npm run server:dev`: Start the backend server with hot-reload.
- `npm run db:push`: Push Drizzle schema changes to the database.

---

## 🏆 Replit Mobile Buildathon

This project demonstrates the power of the **Replit Ecosystem**:

1.  **Coded on Replit**: Developed entirely in the cloud IDE.
2.  **Deployed on Replit**: Backend hosted with instant deployment.
3.  **Built for Mobile**: Native iOS and Android apps from a single Replit project.

**Team**: AXON Core
**Status**: 🚀 Production Ready
