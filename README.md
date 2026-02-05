# AXON

## Open Source Voice-to-ERP Orchestrator

![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-AGPLv3-blue)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey)

**Axon** is an AI-powered inventory management system with a Zero-Knowledge privacy architecture. It bridges the gap between unstructured voice commands and structured ERP systems (1C:Enterprise, SAP, Odoo), enabling hands-free warehouse operations.

---

## 🚀 Key Features

- **Voice-First Interface**: Speak naturally to check stock, create invoices, or move inventory.
- **Universal ERP Connector**: Works with any ERP via OpenAPI/Swagger or OData.
- **Offline-First**: Local storage ensures operations continue even without internet.
- **RAG (Retrieval-Augmented Generation)**: "Talk" to your regulations and manuals securely.
- **Zero-Knowledge Privacy**: Sensitive data is encrypted on-device; only the necessary context reaches the LLM.

## 🛠 Tech Stack

- **Mobile**: React Native (Expo SDK 52)
- **Backend**: NestJS (Node.js)
- **AI Orchestration**: Vercel AI SDK, OpenAI/Groq/Ollama support
- **Database**: PostgreSQL (Drizzle ORM) + Local SQLite
- **Vector Search**: Qdrant (for RAG)

## 📦 Installation

### Prerequisites

- Node.js v20+
- PostgreSQL
- Expo Go (for mobile testing)

### Quick Start

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/axon.git
    cd axon
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Start the server:**

    ```bash
    # In a new terminal
    npm run start:server:dev
    ```

4.  **Start the mobile app:**
    ```bash
    # In a new terminal
    npm run start
    ```

## 🔒 Security

Axon takes security seriously. We use:

- **JWE (JSON Web Encryption)** for payload protection.
- **Ephemeral Client Pool** for managing AI provider keys securely.
- **Guardian Guard** for pre-execution validation of AI tool calls.

Please see [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to submit Pull Requests, report issues, and request features.

## 📄 License

This project is licensed under the **GNU AGPLv3** License - see the [LICENSE](LICENSE) file for details.

## ❤️ Support

If you find this project useful, please consider supporting its development via the **Sponsor** button at the top of the repository.
