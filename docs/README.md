# AXON Documentation Index

**Version:** 1.0.0  
**Last Updated:** 11 Feb 2025  
**Status:** ✅ Complete Technical Documentation Set

---

## 📚 Complete Documentation Map

```
AXON Documentation Structure
├── 📖 README.md (Project Overview) ← START HERE
│   └── Quick overview, features, tech stack
│
├── 🚀 QUICK-START.md (This Folder)
│   └── 5-min setup, common tasks, troubleshooting
│
├── 🏗️ ARCHITECTURE.md
│   └── System design, core principles, patterns
│
├── 📡 API-REFERENCE.md
│   └── Complete REST API documentation
│
├── 💾 DATABASE-SCHEMA.md
│   └── PostgreSQL & SQLite schemas
│
├── 🔧 INSTALLATION-DEPLOYMENT.md
│   └── Development, Docker, Vercel, Replit
│
├── 🔌 INTEGRATION-GUIDES.md
│   └── Add LLM, ERP, RAG providers
│
├── 🔐 SECURITY.md (Root Folder)
│   └── Vulnerability reporting policy
│
└── 📝 CONTRIBUTING.md (Root Folder)
    └── How to contribute
```

---

## 🎯 Documentation by Use Case

### "I'm New to AXON"

**Time: 30 minutes**

1. Read [README.md](../README.md) (5 min)
   - Understand what AXON does
   - See supported platforms

2. Read [QUICK-START.md](./QUICK-START.md) (15 min)
   - Get it running locally
   - Understand core concepts

3. Skim [ARCHITECTURE.md](./ARCHITECTURE.md) (10 min)
   - Understand system design
   - Learn key patterns

**Next:** Pick a task from "Developer Tasks" below

---

### "I Need to Deploy AXON"

**Time: 1-2 hours**

1. [INSTALLATION-DEPLOYMENT.md](./INSTALLATION-DEPLOYMENT.md)
   - Prerequisites & environment setup
   - Docker deployment
   - Replit, Vercel, cloud platforms

2. [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md)
   - PostgreSQL setup
   - Schema explanation
   - Migrations

3. [ARCHITECTURE.md § Scalability](./ARCHITECTURE.md#scalability)
   - Horizontal scaling
   - Connection pooling

---

### "I Need to Use the API"

**Time: 1 hour**

1. [API-REFERENCE.md](./API-REFERENCE.md)
   - Authentication
   - All endpoints with examples
   - Error handling
   - Rate limiting

2. [QUICK-START.md § Test API](./QUICK-START.md#2-test-api-endpoint-locally)
   - Try endpoints with curl
   - Understand request/response format

---

### "I Want to Add a New LLM Provider"

**Time: 2-3 hours**

1. [INTEGRATION-GUIDES.md § Adding LLM Provider](./INTEGRATION-GUIDES.md#adding-a-new-llm-provider)
   - Step-by-step walkthrough
   - Code templates
   - Testing

2. [API-REFERENCE.md § Chat API](./API-REFERENCE.md#chat-api)
   - Understand request structure

3. Test locally with [QUICK-START.md § Debug](./QUICK-START.md#3-debug-mobile-app)

---

### "I Want to Add a New ERP System"

**Time: 3-4 hours**

1. [INTEGRATION-GUIDES.md § Adding ERP System](./INTEGRATION-GUIDES.md#adding-a-new-erp-system)
   - Adapter pattern
   - Step-by-step implementation
   - Testing strategy

2. [ARCHITECTURE.md § Conductor Pattern](./ARCHITECTURE.md#4-conductor-pattern)
   - Understand ERP abstraction

3. [DATABASE-SCHEMA.md](./DATABASE-SCHEMA.md)
   - Understand data storage

---

### "I Need to Troubleshoot an Issue"

**Time: 15-30 minutes**

1. [QUICK-START.md § Common Issues](./QUICK-START.md#common-issues--fixes)
   - Port conflicts
   - Database errors
   - JWT problems
   - API errors

2. [INSTALLATION-DEPLOYMENT.md § Troubleshooting](./INSTALLATION-DEPLOYMENT.md#troubleshooting)
   - Development & deployment issues
   - Performance optimization

---

### "I'm Contributing Code"

**Time: 1-2 hours**

1. [CONTRIBUTING.md](../CONTRIBUTING.md)
   - Code of conduct
   - PR process

2. [QUICK-START.md § Code Quality](./QUICK-START.md#8-code-quality-checks)
   - Linting, formatting, testing

3. [QUICK-START.md § Pre-commit Checklist](./QUICK-START.md#pre-commit-checklist)

---

## 📋 Documentation Contents by File

### QUICK-START.md (This File)

**Length:** ~500 lines  
**Reading Time:** 15-20 minutes  
**Use:** First-time setup, common tasks

**Sections:**

- TL;DR 5-minute setup
- Directory structure
- Core concepts (60 seconds)
- 10 common tasks with code
- Troubleshooting
- Architecture cheat sheet
- Next steps by skill level

**Key Takeaways:**

- How to run the project locally
- Common operations (tests, linting, etc.)
- Quick fixes for errors

---

### ARCHITECTURE.md

**Length:** ~1000 lines  
**Reading Time:** 45-60 minutes  
**Use:** Understanding system design

**Sections:**

- Core principles (Zero-Storage, Offline-First, etc.)
- System design & high-level architecture
- Module structure
- Data flow
- Security architecture
- Scalability patterns
- Design patterns used (Adapter, Strategy, Factory, etc.)

**Key Takeaways:**

- Why AXON is designed this way
- How data flows through the system
- Security measures
- How to extend the system

---

### API-REFERENCE.md

**Length:** ~800 lines  
**Reading Time:** 30-45 minutes  
**Use:** API integration & testing

**Sections:**

- Authentication (OAuth, JWT, refresh)
- Chat API (SSE streaming)
- Voice API (transcription)
- Rules API (CRUD + import)
- Skills API (CRUD + sandboxing)
- RAG API (search + ingestion)
- MCP API (server registration)
- Conductor API (testing)
- Error handling & codes
- Rate limiting
- Workflow examples
- SDK examples (JavaScript, React Native)

**Key Takeaways:**

- All REST endpoints documented
- Request/response formats with examples
- Error codes and handling
- How to integrate with AXON

---

### DATABASE-SCHEMA.md

**Length:** ~900 lines  
**Reading Time:** 30-40 minutes  
**Use:** Understanding data storage

**Sections:**

- Storage architecture overview
- PostgreSQL schema (server-side)
  - users, sessions, rag_documents, audit_logs
- SQLite schema (client-side)
  - conversations, messages, rules, skills, memory, vectors
- Entity relationships (ER diagrams)
- Data types & serialization
- Drizzle ORM examples
- Migrations
- Backup & recovery
- Performance optimization
- GDPR compliance
- Monitoring queries

**Key Takeaways:**

- Where data is stored (client vs server)
- Table structures and relationships
- How to query data
- Performance considerations

---

### INSTALLATION-DEPLOYMENT.md

**Length:** ~1200 lines  
**Reading Time:** 45-60 minutes  
**Use:** Setting up development & production

**Sections:**

- Prerequisites
- Local development setup
- Running backend & frontend
- Production deployment checklist
- Docker deployment + docker-compose
- Replit deployment
- Vercel deployment
- Complete .env template
- Database setup (PostgreSQL, SQLite)
- Troubleshooting (frontend, backend, database)
- Performance optimization
- Monitoring & logging

**Key Takeaways:**

- How to set up local development
- How to deploy to production
- Environment variable configuration
- Troubleshooting common issues

---

### INTEGRATION-GUIDES.md

**Length:** ~1100 lines  
**Reading Time:** 45-60 minutes  
**Use:** Extending with new providers

**Sections:**

- Adding LLM provider (step-by-step with Anthropic example)
- Adding ERP system (step-by-step with NetSuite example)
- Adding RAG provider (with Pinecone example)
- Creating MCP servers
- Custom tool development
- Best practices
- Troubleshooting

**Key Takeaways:**

- How to add support for new LLMs
- How to add support for new ERPs
- How to create external integrations
- Code patterns to follow

---

## 🔍 Quick Reference Tables

### By Document Type

| Document                   | Type      | Audience                 | Length |
| -------------------------- | --------- | ------------------------ | ------ |
| README.md                  | Overview  | Everyone                 | Short  |
| QUICK-START.md             | Tutorial  | Developers               | Medium |
| ARCHITECTURE.md            | Design    | Architects, Senior Devs  | Long   |
| API-REFERENCE.md           | Reference | API Users, Frontend Devs | Long   |
| DATABASE-SCHEMA.md         | Reference | Backend Devs, DBAs       | Long   |
| INSTALLATION-DEPLOYMENT.md | Guide     | DevOps, Backend Devs     | Long   |
| INTEGRATION-GUIDES.md      | Tutorial  | Extension Devs           | Long   |

---

### By Reading Time

**5 minutes:**

- QUICK-START.md § TL;DR Setup
- API-REFERENCE.md § Error Codes table

**15 minutes:**

- QUICK-START.md (full)
- ARCHITECTURE.md § Overview + Principles

**30 minutes:**

- API-REFERENCE.md § Chat API
- DATABASE-SCHEMA.md § Overview
- INSTALLATION-DEPLOYMENT.md § Local Setup

**45-60 minutes:**

- ARCHITECTURE.md (full)
- INTEGRATION-GUIDES.md (full section)
- INSTALLATION-DEPLOYMENT.md (full)

---

### By Role

**Product Manager:**

- README.md
- QUICK-START.md § Core Concepts
- ARCHITECTURE.md § Overview

**Frontend Developer:**

- QUICK-START.md
- API-REFERENCE.md
- DATABASE-SCHEMA.md § SQLite

**Backend Developer:**

- ARCHITECTURE.md
- API-REFERENCE.md
- DATABASE-SCHEMA.md (full)
- INTEGRATION-GUIDES.md

**DevOps Engineer:**

- INSTALLATION-DEPLOYMENT.md
- DATABASE-SCHEMA.md § PostgreSQL
- ARCHITECTURE.md § Scalability

**Integration Developer:**

- INTEGRATION-GUIDES.md
- API-REFERENCE.md
- ARCHITECTURE.md § Design Patterns

---

## 🎓 Learning Paths

### Path 1: From Zero to Contributing (4 hours)

```
Week 1:
├─ Day 1: Read README.md (5 min)
├─ Day 1: Run QUICK-START.md (10 min)
├─ Day 2: Read ARCHITECTURE.md (45 min)
├─ Day 3: Read API-REFERENCE.md (30 min)
└─ Day 4: Make first code change & PR

Week 2:
├─ Read INTEGRATION-GUIDES.md (45 min)
├─ Add first new feature
└─ Submit PR
```

### Path 2: Production Deployment (2 hours)

```
├─ INSTALLATION-DEPLOYMENT.md § Prerequisites (10 min)
├─ INSTALLATION-DEPLOYMENT.md § Environment (15 min)
├─ DATABASE-SCHEMA.md § PostgreSQL (15 min)
├─ INSTALLATION-DEPLOYMENT.md § Production (20 min)
├─ INSTALLATION-DEPLOYMENT.md § Docker (15 min)
└─ Deploy!
```

### Path 3: Adding New Provider (3 hours)

```
├─ ARCHITECTURE.md § Design Patterns (20 min)
├─ INTEGRATION-GUIDES.md § Choose Your Provider (10 min)
├─ Follow step-by-step guide (90 min)
├─ Write tests (20 min)
├─ Document changes (10 min)
└─ Submit PR
```

---

## 🔗 Cross-References

### Architecture Topics

| Topic           | Primary Doc           | Secondary Docs                        |
| --------------- | --------------------- | ------------------------------------- |
| Zero-Storage    | ARCHITECTURE.md       | API-REFERENCE.md                      |
| Offline-First   | ARCHITECTURE.md       | DATABASE-SCHEMA.md (SQLite)           |
| Security        | ARCHITECTURE.md       | INSTALLATION-DEPLOYMENT.md (env vars) |
| Tool Calling    | ARCHITECTURE.md       | API-REFERENCE.md                      |
| LLM Integration | INTEGRATION-GUIDES.md | ARCHITECTURE.md                       |
| ERP Integration | INTEGRATION-GUIDES.md | ARCHITECTURE.md                       |
| Database        | DATABASE-SCHEMA.md    | INSTALLATION-DEPLOYMENT.md            |

---

## ✅ Checklist: What Should Be Documented?

### After Major Features:

- [ ] Update API-REFERENCE.md with new endpoints
- [ ] Update ARCHITECTURE.md with new patterns
- [ ] Update DATABASE-SCHEMA.md if schema changed
- [ ] Add troubleshooting to QUICK-START.md if needed

### After Adding Provider:

- [ ] Add step-by-step guide to INTEGRATION-GUIDES.md
- [ ] Document required environment variables
- [ ] Add example configuration

### After Deployment:

- [ ] Update INSTALLATION-DEPLOYMENT.md with lessons learned
- [ ] Document any gotchas or edge cases
- [ ] Update performance metrics

---

## 🎯 Documentation Goals

✅ **What we aim for:**

- Comprehensive: Cover all major features
- Accessible: Beginner-friendly with examples
- Practical: Code templates, not theory
- Maintainable: Easy to update
- Searchable: Clear structure, good headings

---

## 📞 When to Add Documentation

| When                     | Where                            | What                                 |
| ------------------------ | -------------------------------- | ------------------------------------ |
| New API endpoint         | API-REFERENCE.md                 | Endpoint, request, response, example |
| New architecture pattern | ARCHITECTURE.md                  | Pattern name, use case, diagram      |
| New provider support     | INTEGRATION-GUIDES.md            | Step-by-step guide, code template    |
| New env variable         | INSTALLATION-DEPLOYMENT.md       | Variable name, description, example  |
| Bug fix / workaround     | QUICK-START.md § Troubleshooting | Problem, symptom, solution           |
| New table / schema       | DATABASE-SCHEMA.md               | Table definition, relationships      |

---

## 🔄 Documentation Feedback Loop

```
Feature Developed
       ↓
Docs Written
       ↓
PR Review (docs checked)
       ↓
Merged to main
       ↓
Users Read & Provide Feedback
       ↓
Docs Updated
```

---

## 📦 Exporting Documentation

### Build Documentation Site (Optional)

```bash
# Use docusaurus, nextra, or similar
npm install docusaurus

# Then run
npm run build:docs
```

### PDF Export

```bash
# Convert MD to PDF
npm install markdown-pdf

markdown-pdf QUICK-START.md -o QUICK-START.pdf
```

---

## 🌐 Documentation URLs (When Hosted)

| Document     | Path                     | URL Example                              |
| ------------ | ------------------------ | ---------------------------------------- |
| Index        | /docs                    | https://axon.dev/docs                    |
| Quick Start  | /docs/quick-start        | https://axon.dev/docs/quick-start        |
| Architecture | /docs/architecture       | https://axon.dev/docs/architecture       |
| API          | /docs/api-reference      | https://axon.dev/docs/api-reference      |
| Guides       | /docs/integration-guides | https://axon.dev/docs/integration-guides |

---

## 📊 Documentation Statistics

| Metric                    | Value                 |
| ------------------------- | --------------------- |
| Total Files               | 7                     |
| Total Lines               | ~6,500                |
| Total Characters          | ~450,000              |
| Code Examples             | 50+                   |
| Diagrams                  | 10+                   |
| Tables                    | 30+                   |
| Reading Time              | ~4-5 hours (all docs) |
| Estimated Time to Mastery | 1-2 weeks             |

---

## 🚀 Next: Choose Your Journey

**Choose your next action:**

1. **🔧 Set Up Locally**
   → [QUICK-START.md § TL;DR Setup](./QUICK-START.md#tldr---5-minutes-setup)

2. **📚 Learn System Design**
   → [ARCHITECTURE.md](./ARCHITECTURE.md)

3. **🔌 Extend System**
   → [INTEGRATION-GUIDES.md](./INTEGRATION-GUIDES.md)

4. **🚀 Deploy to Production**
   → [INSTALLATION-DEPLOYMENT.md](./INSTALLATION-DEPLOYMENT.md)

5. **💻 Use the API**
   → [API-REFERENCE.md](./API-REFERENCE.md)

---

## 📝 Changelog

| Date       | Change                                          |
| ---------- | ----------------------------------------------- |
| 2025-02-11 | ✅ Complete technical documentation set created |
| 2025-02-11 | ✅ QUICK-START.md added                         |
| 2025-02-11 | ✅ ARCHITECTURE.md added                        |
| 2025-02-11 | ✅ API-REFERENCE.md added                       |
| 2025-02-11 | ✅ DATABASE-SCHEMA.md added                     |
| 2025-02-11 | ✅ INSTALLATION-DEPLOYMENT.md added             |
| 2025-02-11 | ✅ INTEGRATION-GUIDES.md added                  |

---

**🎉 You now have comprehensive documentation for the entire AXON system!**

---

**Last Updated:** 11 Feb 2025  
**Maintained by:** Axon Team  
**Contributing:** See [CONTRIBUTING.md](../CONTRIBUTING.md)
