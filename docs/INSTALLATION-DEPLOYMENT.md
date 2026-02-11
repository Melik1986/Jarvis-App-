# Installation & Deployment Guide

**Version:** 1.0.0  
**Last Updated:** 11 Feb 2025

---

## Table of Contents

1. [Development Setup](#development-setup)
2. [Local Development](#local-development)
3. [Production Deployment](#production-deployment)
4. [Docker Deployment](#docker-deployment)
5. [Replit Deployment](#replit-deployment)
6. [Vercel Deployment](#vercel-deployment)
7. [Environment Configuration](#environment-configuration)
8. [Database Setup](#database-setup)
9. [Troubleshooting](#troubleshooting)

---

## Development Setup

### Prerequisites

| Software   | Version    | Purpose                          |
| ---------- | ---------- | -------------------------------- |
| Node.js    | v22+       | Runtime for server & build tools |
| npm        | v10+       | Dependency management            |
| PostgreSQL | 14+        | Production database              |
| SQLite3    | 3.x        | Mobile local storage             |
| Git        | Any        | Version control                  |
| Docker     | (optional) | Containerized deployment         |
| Expo CLI   | v51+       | React Native tooling             |

### 1. Clone Repository

```bash
git clone https://github.com/Melik1986/Axon-App.git
cd Axon-App
```

### 2. Install Dependencies

```bash
npm install
```

This installs:

- Frontend: React Native, Expo SDK 55
- Backend: NestJS, TypeScript
- Shared: Drizzle ORM, type definitions

### 3. Setup Environment Variables

Copy template:

```bash
cp .env.example .env
```

Edit `.env` with your values (see [Environment Configuration](#environment-configuration) section).

### 4. Install Husky Pre-commit Hooks

```bash
npm run prepare
```

This enables automatic code formatting and secret scanning before commits.

---

## Local Development

### Running Backend Server

```bash
# Development mode with hot-reload
npm run server:dev

# This starts NestJS on http://localhost:5000
```

The server includes:

- Swagger UI: http://localhost:5000/api/docs
- Health check: http://localhost:5000/health
- CORS enabled for localhost

### Running Mobile App (Expo)

In a separate terminal:

```bash
# Start Expo dev server
npm start

# Or for local testing without Replit:
npm run expo:dev:local
```

Then:

- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan QR code with Expo Go app

### Running Together

| Terminal 1              | Terminal 2     |
| ----------------------- | -------------- |
| `npm run server:dev`    | `npm start`    |
| Backend: localhost:5000 | Frontend: Expo |

---

## Production Deployment

### Prerequisites

- PostgreSQL database (Supabase or self-hosted)
- LLM provider API keys (OpenAI, Groq, etc.)
- ERP credentials
- SSL certificate (https)
- Domain name

### Build Backend

```bash
# Compile TypeScript
npm run server:nest:build

# Output: server/dist/
```

### Build Mobile App

```bash
# Create production EAS build for iOS/Android
npx eas build --platform ios --auto-submit
npx eas build --platform android --auto-submit
```

(Requires EAS account at https://expo.dev)

### Environment Variables for Production

Create `.env.production`:

```bash
# Backend
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://user:password@host/axon_production

# JWT
JWT_SECRET=your_secret_key_min_32_chars

# Auth Providers
REPLIT_CLIENT_ID=your_replit_id
REPLIT_CLIENT_SECRET=your_replit_secret

# LLM Defaults
LLM_DEFAULT_PROVIDER=openai
OPENAI_API_KEY=sk-...

# ERP
ERP_DEFAULT_PROVIDER=1c

# RAG
QDRANT_URL=https://qdrant.example.com
QDRANT_API_KEY=...

# Observability
SENTRY_DSN=https://...
```

### Run Migrations

```bash
# Push schema to PostgreSQL
npm run db:push
```

### Start Server

```bash
npm run server:nest:prod
```

---

## Docker Deployment

### Build Docker Image

Create `Dockerfile` (if not exists):

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build backend
COPY . .
RUN npm run server:nest:build

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => { r.statusCode === 200 ? process.exit(0) : process.exit(1); });"

# Start server
CMD ["node", "server/dist/main.js"]
```

### Build & Run

```bash
# Build image
docker build -t axon:latest .

# Run container
docker run -d \
  --name axon \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET=... \
  axon:latest

# View logs
docker logs -f axon

# Stop container
docker stop axon
```

### Docker Compose (Full Stack)

Create `docker-compose.yml`:

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: axon_user
      POSTGRES_PASSWORD: secure_password
      POSTGRES_DB: axon_production
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U axon_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  axon:
    build: .
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://axon_user:secure_password@postgres:5432/axon_production
      JWT_SECRET: ${JWT_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    ports:
      - "5000:5000"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  postgres_data:
  qdrant_data:
```

Run:

```bash
docker-compose up -d
```

---

## Replit Deployment

Axon is optimized for Replit! The project includes Replit-specific configuration.

### 1. Import from GitHub

1. Go to https://replit.com/new/github
2. Enter: `https://github.com/Melik1986/Axon-App`
3. Click "Import from GitHub"

### 2. Configure Secrets

In Replit Secrets panel:

```
EXPO_PUBLIC_DOMAIN={your-replit-domain}
DATABASE_URL=postgresql://...
JWT_SECRET={generate-random-secret}
OPENAI_API_KEY=sk-...
REPLIT_CLIENT_ID={your-id}
REPLIT_CLIENT_SECRET={your-secret}
```

### 3. Run

```bash
npm run start:server:dev
```

Replit automatically exposes the server on `https://{replit-username}-{project-name}.replit.dev`

### 4. Mobile Testing

In `package.json`, these env vars are auto-set:

```json
"expo:dev": "EXPO_PACKAGER_PROXY_URL=https://$REPLIT_DEV_DOMAIN..."
```

Connect Expo Go app to your Replit project URL.

---

## Vercel Deployment

### For Backend (NestJS)

1. Create `vercel.json`:

```json
{
  "buildCommand": "npm run server:nest:build",
  "outputDirectory": "server/dist",
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "server/dist/main.js": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

2. Connect GitHub repo to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### For Frontend (React Native → Web)

Note: React Native apps deploy via EAS (Expo Application Services), not Vercel.
For web preview, use Expo's web export:

```bash
npx expo export --platform web
# Output: dist/
# Deploy dist/ to Vercel, Netlify, etc.
```

---

## Environment Configuration

### Complete .env Template

```bash
# ============================================
# CORE
# ============================================
NODE_ENV=production
LOG_LEVEL=info
PORT=5000

# ============================================
# EXPO / MOBILE
# ============================================
EXPO_PUBLIC_DOMAIN=https://axon.example.com
REACT_NATIVE_PACKAGER_HOSTNAME=localhost

# ============================================
# DATABASE
# ============================================
# PostgreSQL for server state (users, sessions)
DATABASE_URL=postgresql://user:password@localhost:5432/axon_production

# Optional: SQLite for mobile fallback
SQLITE_PATH=/data/axon_mobile.db

# ============================================
# AUTHENTICATION
# ============================================
JWT_SECRET=your_secret_key_must_be_at_least_32_characters_long
JWT_EXPIRES_IN=3600

# Replit OAuth
REPLIT_CLIENT_ID=your_replit_id
REPLIT_CLIENT_SECRET=your_replit_secret

# OIDC (optional)
OIDC_ISSUER=https://accounts.example.com
OIDC_CLIENT_ID=...
OIDC_CLIENT_SECRET=...

# ============================================
# LLM PROVIDERS
# ============================================
# Default provider: openai | groq | ollama | openrouter | together

LLM_DEFAULT_PROVIDER=openai

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1

# Groq (fast inference)
GROQ_API_KEY=gsk_...

# Ollama (local)
OLLAMA_BASE_URL=http://localhost:11434

# OpenRouter (multi-model)
OPENROUTER_API_KEY=...

# Together AI
TOGETHER_API_KEY=...

# ============================================
# ERP PROVIDERS
# ============================================
ERP_DEFAULT_PROVIDER=1c

# 1C Enterprise
ERP_1C_BASE_URL=https://erp.company.com
ERP_1C_USERNAME=api_user
ERP_1C_PASSWORD=secure_password

# SAP
SAP_BASE_URL=https://sap-api.example.com
SAP_CLIENT_ID=...
SAP_CLIENT_SECRET=...

# Odoo
ODOO_BASE_URL=https://odoo.example.com
ODOO_DB=production
ODOO_USERNAME=api_user
ODOO_PASSWORD=...

# MoySklad
MOYSKLAD_API_KEY=...

# ============================================
# RAG (KNOWLEDGE BASE)
# ============================================
RAG_PROVIDER=qdrant # qdrant | supabase | local

# Qdrant
QDRANT_URL=https://qdrant.example.com
QDRANT_API_KEY=...

# Supabase Vector Store
SUPABASE_URL=https://project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# ============================================
# MCP (MODEL CONTEXT PROTOCOL)
# ============================================
MCP_ALLOWED_HOSTS=localhost:3000,mcp.company.com

# ============================================
# SECURITY
# ============================================
# JWE Encryption
JWE_KEY_SIZE=256 # ECDH-ES+HKDF-256

# CORS
CORS_ORIGIN=https://axon.example.com,exp://*

# Rate Limiting
RATE_LIMIT_WINDOW=60000 # milliseconds
RATE_LIMIT_MAX_REQUESTS=100 # per window

# ============================================
# OBSERVABILITY
# ============================================
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production

# DataDog (optional)
DD_API_KEY=...
DD_SITE=datadoghq.com

# ============================================
# STORAGE & CACHE
# ============================================
# Redis (optional, for distributed rate limiting)
REDIS_URL=redis://localhost:6379

# ============================================
# EMAIL (for notifications)
# ============================================
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=...
SMTP_FROM_EMAIL=noreply@axon.example.com

# ============================================
# TESTING
# ============================================
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/axon_test
SEED_DATABASE=true
```

### Environment Variable Validation

The application validates env vars on startup. Missing required vars will cause startup failure with clear error messages.

---

## Database Setup

### PostgreSQL (Production)

#### Local PostgreSQL

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Linux (Ubuntu)
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows (WSL)
sudo apt install postgresql postgresql-contrib
sudo service postgresql start

# Create user and database
sudo -u postgres createuser axon_user
sudo -u postgres createdb -O axon_user axon_production

# Set password
sudo -u postgres psql
postgres=# ALTER USER axon_user WITH PASSWORD 'secure_password';
```

#### Supabase (Managed PostgreSQL)

1. Create account at https://supabase.com
2. Create new project
3. Copy connection string from Settings → Database
4. Set `DATABASE_URL` in `.env`

#### Database Migrations

```bash
# Push current schema to database
npm run db:push

# Generate new migration after schema change
npx drizzle-kit generate

# See migration status
npx drizzle-kit status
```

### SQLite (Mobile/Local)

SQLite is automatically initialized on first app launch. No manual setup required.

Location:

- iOS: `Documents/axon_user.db`
- Android: `/data/data/com.axon/files/axon_user.db`
- Web: IndexedDB (browser-specific)

---

## Troubleshooting

### Frontend Issues

#### Expo Won't Connect

```bash
# Clear cache
rm -rf .expo
rm -rf node_modules/.cache

# Reinstall
npm install

# Try again
npm start
```

#### React Native Build Error

```
Error: Could not connect to development server.
```

Solution:

```bash
# Make sure server is running
npm run server:dev

# Check port 5000 is open
lsof -i :5000
```

#### SQLite Error on Mobile

```
SQLite database locked
```

Solution:

- Restart app
- Ensure only one connection at a time
- Check AsyncStorage quota (mobile storage limit)

### Backend Issues

#### NestJS Startup Fails

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Solution:

```bash
# PostgreSQL not running
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16

# Or check local installation
brew services start postgresql@16
```

#### JWT Token Invalid

```
Unauthorized: Invalid token
```

Solution:

1. Regenerate `JWT_SECRET` in `.env`
2. Clear tokens on client (`AsyncStorage`)
3. Re-login

#### LLM Provider Error

```
OpenAI API key invalid
```

Solution:

1. Verify API key in `.env`
2. Check API key has correct permissions
3. Check rate limits not exceeded

### Database Issues

#### "Too many connections"

```
FATAL:  remaining connection slots are reserved for non-replication superuser connections
```

Solution:

```sql
-- Check active connections
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;

-- Terminate connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'axon_production';
```

#### Migration Failed

```bash
# Reset to clean state (development only!)
npm run db:push -- --force
```

### Deployment Issues

#### Docker Container Won't Start

```bash
# Check logs
docker logs axon

# Common: missing DATABASE_URL
docker run -e DATABASE_URL=... axon:latest
```

#### Rate Limiting Not Working

Ensure Redis is configured or in-memory fallback is enabled:

```bash
# In-memory (works without Redis)
RATE_LIMIT_PROVIDER=memory

# Or with Redis
REDIS_URL=redis://localhost:6379
```

#### CORS Errors

```
Access-Control-Allow-Origin header is missing
```

Solution in `.env`:

```bash
CORS_ORIGIN=https://your-domain.com,exp://localhost:19000
```

---

## Performance Optimization

### Server

```bash
# Monitor memory usage
NODE_OPTIONS="--max-old-space-size=4096" npm run server:nest:prod

# Enable clustering (if using CPU-bound operations)
# See server/src/main.ts for clustering example
```

### Database

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_vector_documents_similarity ON documents USING ivfflat (vector);
```

### Mobile App

```bash
# Build optimized APK/IPA
npx eas build --platform android --auto-submit --release
```

---

## Monitoring & Logging

### Backend Logs

```bash
# View real-time logs
npm run server:dev

# Log levels: debug | info | warn | error
LOG_LEVEL=debug npm run server:dev
```

### Client Logs

In mobile app:

```typescript
// Check console logs (Expo) or LogBox in React Native
console.log("Debug message");
console.warn("Warning");
console.error("Error");
```

### Sentry Error Tracking

```bash
# Set Sentry DSN
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
```

---

**Next Steps:**

1. [API Reference](./API-REFERENCE.md) — Understand REST endpoints
2. [Architecture Guide](./ARCHITECTURE.md) — Deep dive into design
3. [Contributing](../CONTRIBUTING.md) — Contribute to the project

---

**Last Updated:** 11 Feb 2025  
**Maintained by:** Axon Team
