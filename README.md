<div align="center">

![AXON Banner](assets/images/baner-axon.dark.png)

# AXON

### Voice-to-ERP AI Orchestrator

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](https://github.com/Melik1986/Axon-App/actions)
[![License](https://img.shields.io/badge/license-AGPLv3-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey?style=flat-square)](#)
[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2055-000020?style=flat-square&logo=expo)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.83-61DAFB?style=flat-square&logo=react)](https://reactnative.dev)
[![NestJS](https://img.shields.io/badge/NestJS-10-E0234E?style=flat-square&logo=nestjs)](https://nestjs.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

**AI-powered inventory management with Zero-Knowledge privacy architecture.**  
Bridges unstructured voice commands and structured ERP systems (1C:Enterprise, SAP, Odoo).

</div>

---

## 🎯 What is AXON?

AXON transforms how businesses interact with ERP systems. Instead of navigating complex menus, users simply **speak** or **show** what they need. The AI agent translates natural language into structured API calls, making enterprise software accessible to everyone—from warehouse workers to CEOs.

### Supported LLM Providers

[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com)
[![Groq](https://img.shields.io/badge/Groq-LPU-F55036?style=for-the-badge)](https://groq.com)
[![Ollama](https://img.shields.io/badge/Ollama-Local-000000?style=for-the-badge)](https://ollama.ai)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-Multi--Model-6366F1?style=for-the-badge)](https://openrouter.ai)
[![Together AI](https://img.shields.io/badge/Together-AI-FF6B6B?style=for-the-badge)](https://together.ai)

### Supported ERP Systems

[![1C Enterprise](https://img.shields.io/badge/1C-Enterprise-FFCC00?style=for-the-badge)](https://1c.ru)
[![SAP](https://img.shields.io/badge/SAP-ERP-0FAAFF?style=for-the-badge&logo=sap&logoColor=white)](https://sap.com)
[![Odoo](https://img.shields.io/badge/Odoo-ERP-875A7B?style=for-the-badge&logo=odoo&logoColor=white)](https://odoo.com)
[![MoySklad](https://img.shields.io/badge/МойСклад-API-4CAF50?style=for-the-badge)](https://moysklad.ru)

---

## ✨ Key Features

| Feature                        | Description                                                        |
| ------------------------------ | ------------------------------------------------------------------ |
| 🎤 **Voice-First Interface**   | Speak naturally to check stock, create invoices, or move inventory |
| 📷 **Vision AI**               | Scan invoices, price tags, barcodes — auto-create documents        |
| 🔌 **Universal ERP Connector** | Works with any ERP via OpenAPI/Swagger or OData                    |
| 📚 **RAG Knowledge Base**      | "Talk" to your regulations and manuals via Qdrant                  |
| 🔒 **Zero-Knowledge Privacy**  | Sensitive data encrypted on-device; only context reaches LLM       |
| 📴 **Offline-First**           | Local storage ensures operations continue without internet         |
| 🤖 **BYO-LLM**                 | Bring your own LLM provider — configure via app settings           |
| 🔗 **MCP Support**             | Model Context Protocol for external tool integration               |

---

## 🛠 Tech Stack

<table>
<tr>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/react/61DAFB" width="48" height="48" alt="React Native" />
<br>React Native
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/expo/000020" width="48" height="48" alt="Expo" />
<br>Expo SDK 55
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/nestjs/E0234E" width="48" height="48" alt="NestJS" />
<br>NestJS
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/typescript/3178C6" width="48" height="48" alt="TypeScript" />
<br>TypeScript
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/postgresql/4169E1" width="48" height="48" alt="PostgreSQL" />
<br>PostgreSQL
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/supabase/3FCF8E" width="48" height="48" alt="Supabase" />
<br>Supabase
</td>
</tr>
<tr>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/openai/412991" width="48" height="48" alt="OpenAI" />
<br>Vercel AI SDK
</td>
<td align="center" width="96">
<img src="https://qdrant.tech/images/logo_with_text.png" width="48" height="48" alt="Qdrant" />
<br>Qdrant
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/drizzle/C5F74F" width="48" height="48" alt="Drizzle" />
<br>Drizzle ORM
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/sqlite/003B57" width="48" height="48" alt="SQLite" />
<br>SQLite
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/docker/2496ED" width="48" height="48" alt="Docker" />
<br>Docker
</td>
<td align="center" width="96">
<img src="https://cdn.simpleicons.org/github/181717" width="48" height="48" alt="GitHub Actions" />
<br>CI/CD
</td>
</tr>
</table>

---

## 📱 Modules

### 🎤 Jarvis Voice

Record audio via `expo-av`, transcribe with **Whisper**, execute commands via function calling.

```
User: "Покажи остатки молока на складе Центральный"
Axon: Найдено 3 позиции: Молоко 2.5% — 120 шт, Молоко 3.2% — 85 шт...
```

### 📷 Jarvis Vision

Analyze photos of invoices and price tags with **GPT-4o Vision** → auto-create documents in ERP.

```
User: *uploads photo of invoice*
Axon: Распознана накладная №1234 от 15.01.2025. Создать приходный документ?
```

### 📚 RAG Knowledge Base

Search internal instructions and company regulations stored in **Qdrant** vector database.

```
User: "Как оформить возврат товара?"
Axon: Согласно регламенту §3.2: Возврат оформляется через документ...
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js v22+
- PostgreSQL (or Supabase)
- Expo Go app (for mobile testing)
- Docker (optional, for gitleaks)

### Installation

```bash
# Clone the repository
git clone https://github.com/Melik1986/Axon-App.git
cd Axon-App

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your EXPO_PUBLIC_DOMAIN

# Start the server
npm run start:server:dev

# In another terminal — start mobile app
npm start
```

### Configuration

All secrets (LLM keys, ERP credentials, Supabase, Qdrant) are configured via:

- **App UI**: Settings screen, MCP Servers screen
- **Replit**: Secrets panel
- **Hosting**: Environment variables dashboard

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AXON Mobile App                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │  Voice UI   │  │  Vision UI  │  │   Chat UI   │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │    Zustand Store      │  ◄── Offline-First       │
│              │   (AsyncStorage)      │                          │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │ HTTPS/WSS
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                      NestJS Backend                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  LLM Module  │  │  ERP Module  │  │  RAG Module  │           │
│  │ (AI SDK)     │  │ (OData/REST) │  │  (Qdrant)    │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                 │                 │                    │
│         ▼                 ▼                 ▼                    │
│  ┌─────────────────────────────────────────────────────┐        │
│  │              AI Adapter Pattern                      │        │
│  │   Dynamic Tool Generation from OpenAPI/Swagger       │        │
│  └─────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
      ┌─────────┐    ┌─────────┐    ┌─────────┐
      │   1C    │    │   SAP   │    │  Odoo   │
      │  OData  │    │   API   │    │   API   │
      └─────────┘    └─────────┘    └─────────┘
```

---

## 🔒 Security

- **JWE (JSON Web Encryption)** for payload protection
- **Ephemeral Client Pool** for managing AI provider keys securely
- **Guardian Guard** for pre-execution validation of AI tool calls
- **Gitleaks** pre-commit hook for secret scanning

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is licensed under the **GNU AGPLv3** License — see [LICENSE](LICENSE).

---

<div align="center">

**Built with ❤️ for the Replit Mobile Buildathon**

[![Run on Replit](https://replit.com/badge/github/Melik1986/Axon-App)](https://replit.com/new/github/Melik1986/Axon-App)

</div>
