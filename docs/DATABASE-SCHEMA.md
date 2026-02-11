# Database Schema Documentation

**Version:** 1.0.0  
**Storage:** PostgreSQL (server-side), SQLite (client-side)  
**ORM:** Drizzle ORM  
**Last Updated:** 11 Feb 2025

---

## Overview

### Storage Architecture

**Zero-Storage Principle:**

- **Server (PostgreSQL):** User accounts, sessions, document indices (minimal)
- **Client (SQLite):** Conversations, rules, skills, cache (everything else)

**Why two databases?**

- PostgreSQL: Multi-tenant, persistent, searchable
- SQLite: Local, fast, no network latency

---

## PostgreSQL Schema (Server)

### Purpose

- User authentication & sessions
- Document metadata (for RAG search)
- Audit logs (optional)
- System configuration

### Tables

#### `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  provider VARCHAR(50) NOT NULL, -- 'replit', 'oidc', 'jwt'
  provider_id VARCHAR(255) NOT NULL,
  display_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,

  -- Metadata
  preferences JSONB DEFAULT '{}'::jsonb, -- Theme, language, etc.

  -- Rate limiting
  rate_limit_tokens INT DEFAULT 100,
  rate_limit_reset_at TIMESTAMP,

  UNIQUE(provider, provider_id)
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider ON users(provider, provider_id);
```

#### `sessions`

```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Token info
  access_token_hash VARCHAR(255) NOT NULL,
  refresh_token_hash VARCHAR(255) NOT NULL,

  -- Metadata
  user_agent TEXT,
  ip_address INET,
  device_name VARCHAR(255),

  -- Lifecycle
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  is_revoked BOOLEAN DEFAULT false,

  CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_access_token_hash ON sessions(access_token_hash);
```

#### `rag_documents`

```sql
CREATE TABLE rag_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Document metadata
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50), -- 'pdf', 'md', 'txt', etc.
  file_size_bytes INT,
  file_hash VARCHAR(255) UNIQUE, -- For deduplication

  -- Content storage (for small documents)
  content_text TEXT,

  -- Vector store reference
  vector_store_id VARCHAR(255), -- Qdrant collection ID
  chunk_count INT DEFAULT 0,
  embedding_model VARCHAR(100),

  -- Metadata
  title VARCHAR(255),
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb, -- ["tag1", "tag2"]
  metadata JSONB DEFAULT '{}'::jsonb, -- Custom metadata
  source_url TEXT,

  -- Lifecycle
  uploaded_at TIMESTAMP DEFAULT NOW(),
  indexed_at TIMESTAMP,
  expires_at TIMESTAMP, -- Optional auto-deletion
  is_active BOOLEAN DEFAULT true,

  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'indexed', 'failed'
  error_message TEXT,

  UNIQUE(user_id, file_hash)
);

CREATE INDEX idx_rag_documents_user_id ON rag_documents(user_id);
CREATE INDEX idx_rag_documents_status ON rag_documents(status);
CREATE INDEX idx_rag_documents_tags ON rag_documents USING GIN(tags);
```

#### `rag_chunks`

```sql
CREATE TABLE rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,

  -- Chunk content
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,

  -- Metadata
  tokens INT,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Vector reference
  embedding_id VARCHAR(255), -- Qdrant point ID

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rag_chunks_document_id ON rag_chunks(document_id);
```

#### `audit_logs` (Optional)

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Action details
  action VARCHAR(100) NOT NULL, -- 'create_invoice', 'delete_rule', etc.
  resource_type VARCHAR(100), -- 'invoice', 'rule', 'skill', etc.
  resource_id VARCHAR(255),

  -- Changes
  changes JSONB, -- {before: {...}, after: {...}}

  -- Metadata
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(50), -- 'success', 'failed'
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

---

## SQLite Schema (Client/Mobile)

### Purpose

- Store all conversations, messages, rules, skills
- Local caching
- Offline-first operation

### Tables

#### `conversations`

```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  user_id TEXT,

  -- AI Settings (snapshot at conversation creation)
  llm_provider TEXT, -- 'openai', 'groq', etc.
  llm_model TEXT,

  -- ERP Settings
  erp_provider TEXT,
  erp_base_url TEXT,

  -- Metadata
  is_archived BOOLEAN DEFAULT 0,
  created_at INTEGER, -- Unix timestamp
  updated_at INTEGER,

  -- Sync status
  synced_to_server BOOLEAN DEFAULT 0
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
```

#### `messages`

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id),

  -- Message content
  role TEXT NOT NULL, -- 'user', 'assistant'
  content TEXT NOT NULL,

  -- Metadata
  created_at INTEGER NOT NULL, -- Unix timestamp
  edited_at INTEGER,

  -- Tool calls (JSON)
  tool_calls TEXT, -- Serialized ToolCall[]
  tool_results TEXT, -- Serialized ToolResult[]

  -- Metadata
  tokens_used INT,
  cost_estimate REAL,

  -- Sync
  synced_to_server BOOLEAN DEFAULT 0,
  sync_failed_reason TEXT
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

#### `rules`

```sql
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  user_id TEXT,

  -- Rule metadata
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'validation', 'verification', 'governance'

  -- Rule definition (JSON)
  condition TEXT, -- JSON-serialized condition
  actions TEXT, -- JSON-serialized actions[]

  -- Settings
  enabled BOOLEAN DEFAULT 1,
  priority INT DEFAULT 0,

  -- Content (if imported from markdown)
  content TEXT,

  -- Lifecycle
  created_at INTEGER,
  updated_at INTEGER,

  -- Metadata
  tags TEXT, -- JSON array: ["tag1", "tag2"]
  is_custom BOOLEAN DEFAULT 1,
  is_system BOOLEAN DEFAULT 0
);

CREATE INDEX idx_rules_user_id ON rules(user_id);
CREATE INDEX idx_rules_enabled ON rules(enabled);
```

#### `skills`

```sql
CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  user_id TEXT,

  -- Skill metadata
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'javascript', 'markdown', 'http'

  -- Implementation
  content TEXT NOT NULL, -- JS code or MD documentation

  -- Settings
  enabled BOOLEAN DEFAULT 1,
  is_public BOOLEAN DEFAULT 0,

  -- Lifecycle
  created_at INTEGER,
  updated_at INTEGER,

  -- Usage
  invocation_count INT DEFAULT 0,
  last_invoked_at INTEGER,

  -- Metadata
  tags TEXT, -- JSON array
  version TEXT DEFAULT '1.0.0',

  -- Testing
  test_cases TEXT, -- JSON array of test cases
  last_test_result TEXT -- 'pass' | 'fail' | NULL
);

CREATE INDEX idx_skills_user_id ON skills(user_id);
```

#### `rules_logs`

```sql
CREATE TABLE rules_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  rule_id TEXT,

  -- What triggered the rule
  trigger_type TEXT, -- 'tool_call', 'user_input', etc.
  trigger_data TEXT, -- JSON

  -- Rule evaluation
  matched BOOLEAN,
  action_taken TEXT, -- 'allow', 'reject', 'warn', 'confirm'

  -- Metadata
  created_at INTEGER,

  FOREIGN KEY(rule_id) REFERENCES rules(id)
);

CREATE INDEX idx_rules_logs_user_id ON rules_logs(user_id);
CREATE INDEX idx_rules_logs_rule_id ON rules_logs(rule_id);
```

#### `memory_facts`

```sql
CREATE TABLE memory_facts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  conversation_id TEXT,

  -- Fact storage
  key TEXT NOT NULL,
  value TEXT NOT NULL, -- JSON
  fact_type TEXT, -- 'customer', 'product', 'supplier', etc.

  -- Retrieval hints
  relevance_score REAL DEFAULT 1.0, -- 0-1
  last_used_at INTEGER,
  use_count INT DEFAULT 0,

  -- Lifecycle
  created_at INTEGER,
  updated_at INTEGER,
  expires_at INTEGER, -- Optional: auto-delete old facts

  UNIQUE(user_id, key)
);

CREATE INDEX idx_memory_facts_user_id ON memory_facts(user_id);
CREATE INDEX idx_memory_facts_fact_type ON memory_facts(fact_type);
```

#### `conversation_summaries`

```sql
CREATE TABLE conversation_summaries (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id),

  -- Summary content
  summary TEXT NOT NULL,

  -- Metadata
  message_count INT,
  token_count INT,

  -- Lifecycle
  created_at INTEGER,
  updated_at INTEGER
);
```

#### `vector_embeddings` (Local RAG)

```sql
CREATE TABLE vector_embeddings (
  id TEXT PRIMARY KEY,
  user_id TEXT,

  -- Content
  content TEXT NOT NULL,

  -- Embedding vector (stored as JSON for SQLite)
  embedding TEXT NOT NULL, -- JSON array of floats

  -- Metadata
  source_type TEXT, -- 'document', 'conversation', 'skill'
  source_id TEXT,

  -- Lifecycle
  created_at INTEGER,

  UNIQUE(user_id, source_id)
);

CREATE INDEX idx_vector_embeddings_user_id ON vector_embeddings(user_id);
```

#### `local_cache`

```sql
CREATE TABLE local_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL, -- JSON

  -- Lifecycle
  created_at INTEGER,
  expires_at INTEGER,

  -- Cache control
  ttl_seconds INT
);

CREATE INDEX idx_local_cache_expires_at ON local_cache(expires_at);
```

---

## Relationships & Constraints

### PostgreSQL ER Diagram

```
users
  ├─→ sessions (1:N)
  ├─→ rag_documents (1:N)
  └─→ audit_logs (1:N)

rag_documents
  └─→ rag_chunks (1:N)
```

### SQLite ER Diagram

```
conversations (user_id)
  ├─→ messages (1:N)
  └─→ conversation_summaries (1:1)

rules (user_id)
  └─→ rules_logs (1:N)

skills (user_id)

memory_facts (user_id, conversation_id)

vector_embeddings (user_id)

local_cache (global)
```

---

## Data Types & Serialization

### JSON Fields

| Field         | Example                                         | Purpose                    |
| ------------- | ----------------------------------------------- | -------------------------- |
| `metadata`    | `{"department": "sales", "confidential": true}` | Store arbitrary properties |
| `tags`        | `["urgent", "customer123"]`                     | Search & filter            |
| `preferences` | `{"theme": "dark", "language": "en"}`           | User settings              |
| `changes`     | `{"before": {...}, "after": {...}}`             | Audit trail                |

### Timestamps

| Type       | Format                   | Usage                   |
| ---------- | ------------------------ | ----------------------- |
| PostgreSQL | `TIMESTAMP` (ISO 8601)   | UTC, database level     |
| SQLite     | `INTEGER` (Unix seconds) | Portable, math-friendly |

---

## Drizzle ORM Schema

### Example: Conversations Table

```typescript
// shared/schema.ts
import {
  pgTable,
  sqliteTable,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

// PostgreSQL schema
export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// SQLite schema
export const conversationsTable = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  title: text("title"),
  userId: text("user_id"),
  llmProvider: text("llm_provider"),
  createdAt: integer("created_at"),
  isArchived: integer("is_archived").default(0),
});
```

### Type Generation

```bash
# Generate TypeScript types from schema
npx drizzle-kit introspect

# Output: src/db/schema.types.ts
export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
```

---

## Migration Management

### Creating Migrations

```bash
# After modifying schema.ts
npx drizzle-kit generate

# Output: migrations/0001_add_rag_documents.sql
```

### Applying Migrations

```bash
# Push to database
npm run db:push

# Or using migrations directory
npx drizzle-kit migrate
```

### Rollback

```bash
# Drizzle doesn't have built-in rollback
# Manual approach:
psql -d axon_production -f migrations/0001_add_rag_documents.down.sql
```

---

## Backup & Recovery

### PostgreSQL Backup

```bash
# Full backup
pg_dump -U axon_user axon_production > backup.sql

# With compression
pg_dump -U axon_user axon_production | gzip > backup.sql.gz

# Restore
psql -U axon_user axon_production < backup.sql
```

### SQLite Backup (Mobile)

```typescript
// Backup to cloud (optional)
import * as FileSystem from "expo-file-system";

const backupPath = `${FileSystem.documentDirectory}axon_user.db`;
await FileSystem.copyAsync({
  from: backupPath,
  to: `${FileSystem.cacheDirectory}axon_backup.db`,
});
```

---

## Performance Optimization

### Indexing Strategy

| Table           | Column                        | Reason                 | Index Type |
| --------------- | ----------------------------- | ---------------------- | ---------- |
| `users`         | `email`                       | Login lookup           | BTREE      |
| `sessions`      | `user_id`                     | Session lookup         | BTREE      |
| `rag_documents` | `user_id, status`             | Query by user & status | BTREE      |
| `rag_documents` | `tags`                        | Full-text search       | GIN        |
| `messages`      | `conversation_id, created_at` | Fetch message history  | BTREE      |
| `rules`         | `user_id, enabled`            | Load active rules      | BTREE      |

### Query Optimization

```sql
-- ❌ SLOW: N+1 query
SELECT * FROM conversations WHERE user_id = ?;
-- For each conversation, query messages

-- ✅ FAST: Join
SELECT c.*, COUNT(m.id) as message_count
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE c.user_id = ?
GROUP BY c.id;
```

### Connection Pooling

```typescript
// server/src/database.ts
import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

---

## Data Privacy & Compliance

### GDPR Compliance

#### Right to be Forgotten

```sql
-- Delete user and all data
DELETE FROM users WHERE id = ?;
-- Cascading deletes handle:
-- - sessions
-- - rag_documents + rag_chunks
-- - audit_logs (optional: keep anonymized)
```

#### Data Portability

```typescript
// Export user data
async exportUserData(userId) {
  return {
    user: await getUserData(userId),
    conversations: await getConversations(userId),
    rules: await getRules(userId),
    skills: await getSkills(userId),
  };
}
```

### Data Retention

```sql
-- Auto-delete expired sessions
DELETE FROM sessions WHERE expires_at < NOW();

-- Archive old conversations (optional)
UPDATE conversations
SET is_archived = true
WHERE updated_at < NOW() - INTERVAL '90 days';
```

---

## Monitoring & Analytics

### Key Queries

```sql
-- Active users today
SELECT COUNT(DISTINCT user_id) FROM sessions
WHERE last_activity_at > NOW() - INTERVAL '24 hours';

-- Most used RAG documents
SELECT file_name, COUNT(*) as searches
FROM rag_documents
JOIN rag_chunks ON rag_documents.id = rag_chunks.document_id
GROUP BY rag_documents.id
ORDER BY searches DESC
LIMIT 10;

-- Rule effectiveness
SELECT rule_id, action_taken, COUNT(*) as count
FROM rules_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY rule_id, action_taken;
```

---

## Testing & Seeding

### Seed Database (Development)

```typescript
// scripts/seed.ts
import { drizzle } from "drizzle-orm/postgres-js";

async function seed() {
  const db = drizzle(process.env.DATABASE_URL);

  await db.insert(users).values([
    { username: "admin", email: "admin@test.com" },
    { username: "user1", email: "user1@test.com" },
  ]);

  console.log("✅ Seeding complete");
}

seed().catch(console.error);
```

```bash
# Run seed
npx ts-node scripts/seed.ts
```

---

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/)
- [SQLite Full-Text Search](https://www.sqlite.org/fts5.html)

---

**Last Updated:** 11 Feb 2025  
**Maintained by:** Axon Team
