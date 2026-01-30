<div align="center">

# 🧞‍♂️ Jarvis-App: Universal AI ERP OS

**Build for Replit Mobile Buildathon**

[![Run on Replit](https://replit.com/badge/github/Melik1986/Jarvis-App)](https://replit.com/new/github/Melik1986/Jarvis-App)
[![Expo](https://img.shields.io/badge/Expo-54.0-black.svg?style=flat-square&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-blue.svg?style=flat-square&logo=react&logoColor=white)](https://reactnative.dev)
[![OpenAI](https://img.shields.io/badge/AI-Powered-green.svg?style=flat-square&logo=openai&logoColor=white)](https://openai.com)

**Transforming ERP interaction with Voice, Vision, and AI Agents.**
*One codebase, infinite possibilities on iOS & Android.*

[Features](#features) • [Tech Stack](#tech-stack) • [Architecture](#architecture) • [Getting Started](#getting-started)

</div>

---

## 🚀 Overview

**Jarvis-App** is a mobile-first AI agent designed to revolutionize how businesses interact with their ERP systems (like 1C, SAP, Odoo). Instead of navigating complex menus, users simply **speak** or **show** what they need.

Built on the **Replit Native** stack, Jarvis leverages the power of Large Language Models (LLMs) to translate natural language into structured API calls, making enterprise software accessible to everyone, from warehouse workers to CEOs.

### 🏆 The "Wow" Factor

- **Talk to your Business**: "How much coffee do we have left?" -> *Jarvis checks 1C inventory instantly.*
- **See and Act**: Snap a photo of an invoice -> *Jarvis parses it and creates a document in the ERP.*
- **Universal Adapter**: Connects to ANY system via OpenAPI/Swagger specs using the **AI Adapter Pattern**.

---

## ✨ Key Features

### 🗣️ Jarvis Voice

Hands-free operation using **Expo AV** and **Whisper**.

- Real-time voice command processing.
- Natural conversation with context awareness.
- Perfect for on-the-go employees.

### 👁️ Jarvis Vision

Intelligent visual analysis using **Expo Camera** and **GPT-4o**.

- Instant document recognition (invoices, receipts).
- Barcode and product scanning.
- Visual inventory audits.

### 📚 RAG Librarian

Smart knowledge base integration.

- Semantic search across internal regulations and manuals.
- Instant answers to "How do I process a return?" based on company policy.

### 🔌 Universal ERP Connector (MCP)

**Model Context Protocol** implementation for seamless integration.

- **BYO-LLM**: Bring Your Own LLM (OpenAI, Groq, Ollama).
- **Auto-Mapping**: Dynamically maps natural language to ERP API endpoints using Swagger/OpenAPI specs.
- **Zero-Code Integration**: Just provide the API spec, and Jarvis figures out the rest.

---

## 🛠️ Tech Stack (The Replit Native Stack)

We chose a unified, modern stack optimized for speed and cross-platform deployment.

### Mobile & Frontend (Replit Native)

- **Framework**: [React Native](https://reactnative.dev) (v0.81) + [Expo](https://expo.dev) (v54)
- **Language**: TypeScript
- **UI Engine**: React 19, React Native Reanimated, Expo Blur/Glass
- **Navigation**: React Navigation v7
- **State**: Zustand + React Query

### Backend & AI

- **Server**: Node.js + Express 5.0 (Running on Replit)
- **Database**: PostgreSQL (Supabase) + Drizzle ORM
- **AI Engine**: OpenAI SDK (GPT-4o), Vercel AI SDK patterns
- **Protocols**: WebSocket (ws), REST

### Why this stack?

1. **Write Once, Run Everywhere**: iOS, Android, and Web from a single codebase.
2. **Speed**: Instant feedback loop with Expo Go and Replit's fast environment.
3. **Modernity**: Leveraging React 19 and the latest React Native architecture.

---

## 🏗️ Architecture

### AI Adapter Pattern

Instead of hardcoding integrations, Jarvis uses an abstract layer:

1. **Input**: User Voice/Text/Image.
2. **Processing**: LLM analyzes intent against a loaded **OpenAPI Specification**.
3. **Execution**: System generates the correct API call (REST/OData) for the specific ERP.

### Local-First & Offline

- **Zustand Persist**: For offline access to critical data (stock levels, tasks).
- **Optimistic Updates**: Smooth UX even with spotty connections.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v20+)
- [Expo Go](https://expo.dev/client) app installed on your phone.

### Installation

1. **Clone the repository**

    ```bash
    git clone https://github.com/Melik1986/Jarvis-App.git
    cd Jarvis-App
    ```

2. **Install dependencies**

    ```bash
    npm install
    # or
    bun install
    ```

3. **Set up Environment**
    Create a `.env` file with your keys:

    ```env
    OPENAI_API_KEY=your_key_here
    DATABASE_URL=your_postgres_url
    ```

4. **Run the Server**

    ```bash
    npm run server:dev
    ```

5. **Run the Mobile App**

    ```bash
    npm run expo:dev
    ```

    *Scan the QR code with Expo Go to launch on your device!*

---

## 📱 Replit Mobile Buildathon

This project was crafted specifically for the **Replit Mobile Buildathon**. It demonstrates the power of building complex, enterprise-grade AI applications entirely within the Replit ecosystem, targeting mobile devices natively.

**Developer**: [Melik Musinian]

---

<div align="center">
  <sub>Built with ❤️ on Replit</sub>
</div>
