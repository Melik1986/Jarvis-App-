---
name: jarvis-1c-project
description: Provides project context for JSRVIS 1C Mobile — modules (Voice, Vision, RAG, 1C Integrator), stack (Supabase, Zustand, Vercel AI SDK), AI Adapter Pattern, BYO-LLM, MCP. Use when working on Jarvis/JSRVIS codebase, 1C or ERP integrations, voice/vision/RAG features, or when the user refers to project.md, TZ (ТЗ), or project context. Expert practices for stack — rule tech-stack-expert.mdc.
---

# JSRVIS 1C Mobile — Project Context

## Purpose

Mobile AI agent for 1C business processes (Universal AI ERP OS). Unstructured input (voice, photo, chat) → structured 1C API calls + RAG analytics.

## Modules

| Module | Stack | Role |
|--------|--------|------|
| **Jarvis Voice** | expo-av, Whisper | Record → transcribe → execute commands |
| **Jarvis Vision** | GPT-4o-mini | Photo of invoices/price tags → auto-create documents |
| **RAG (Library)** | Qdrant | Search company instructions/regulations |
| **1C Integrator** | Nest.js | Auth + map AI intents to OData/HTTP to 1C |

## Stack & Constraints

- **Auth**: Phone OTP (Supabase).
- **Offline-first** (e.g. stock view): Zustand + Persist.
- **LLM streaming**: Vercel AI SDK.
- **Structure**: Monorepo-style, end-to-end typing.

## AI Adapter Pattern

Abstract layer instead of per-system code (1C, МойСклад, Odoo, SAP).

1. **Settings**: URL, type (REST/OData/GraphQL), API key.
2. **Spec**: Preset (e.g. «1С:УНФ») or link to Swagger/OpenAPI (JSON/YAML).
3. **LLM mapping**: From API spec the model picks method and params (e.g. «остатки» → GET /v1/inventory, filter by name).

## Budget universality

1. **BYO-LLM**: Settings screen — Base URL, API Key, Model Name; Vercel AI SDK with overridden baseURL (OpenAI-compatible: Groq, Together, OpenRouter, Ollama).
2. **Universal ERP connector**: Nest.js backend parses OpenAPI/Swagger and dynamically generates Tools (Function Calling) for the model.
3. **MCP**: Model Context Protocol support for servers (Sheets, PostgreSQL, ERP).

## Local-First

Ollama preset — closed-loop usage without cloud tokens.

## Expert stack (from TZ)

Языки и библиотеки из ТЗ — экспертные практики в правиле **`.cursor/rules/tech-stack-expert.mdc`**. При работе с этими технологиями подключать это правило.

| Категория | Языки / библиотеки |
|-----------|---------------------|
| Языки | TypeScript (strict, shared types), JavaScript (Web Audio — опционально) |
| Backend | Nest.js, bun |
| Mobile | Expo, React Native, Tamagui, react-native-gifted-chat, expo-av |
| AI/LLM | Vercel AI SDK, OpenAI (Whisper, GPT-4o-mini), Function Calling |
| Auth | Supabase (Phone OTP) |
| State/Offline | Zustand + Persist |
| Vector DB | Qdrant |
| 1C | OData/HTTP, туннель (ngrok/Cloudflare) |

ТЗ: `attached_assets/(ТЗ)_JSRVIS_1C_Mobile_1769190888988.md`, `project/project.md`.

## When coding

- Prefer existing patterns in `client/`, `server/`, `shared/`.
- For integrations and API design, follow AI Adapter Pattern and BYO-LLM/ERP/MCP above.
- For **expert practices** on Nest.js, Expo, Tamagui, Zustand, Vercel AI SDK, Supabase, Qdrant, expo-av, react-native-gifted-chat, 1C — use rule **tech-stack-expert.mdc**.
- For full TZ and Web Audio snippet, see [reference.md](reference.md).
