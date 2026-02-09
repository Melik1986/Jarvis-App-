/**
 * Local SQLite store for all user data (zero-storage policy).
 * Conversations, messages, rules, skills -- everything on the phone.
 */
import * as SQLite from "expo-sqlite";
import { AppLogger } from "./logger";

// ─── Types ───────────────────────────────────────────────────
export interface LocalConversation {
  id: string;
  title: string;
  createdAt: number;
  forkedFrom?: string | null;
  forkedAtMessage?: string | null;
  summary?: string | null;
}

export interface MemoryFact {
  id: string;
  key: string;
  value: string;
  sourceConversationId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface LocalMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  attachments: string | null; // JSON string
  metadata: string | null; // JSON string
  createdAt: number;
}

export interface LocalRule {
  id: string;
  name: string;
  description: string | null;
  condition: string;
  action: string;
  message: string | null;
  content: string | null; // MD instruction body
  priority: number;
  enabled: number; // SQLite boolean: 0 | 1
  createdAt: number;
}

export interface LocalSkill {
  id: string;
  name: string;
  description: string | null;
  code: string;
  content: string | null; // MD instruction body
  inputSchema: string | null;
  outputSchema: string | null;
  enabled: number; // SQLite boolean: 0 | 1
  createdAt: number;
}

// ─── Helpers ─────────────────────────────────────────────────
function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Store ───────────────────────────────────────────────────
class LocalStore {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    try {
      this.db = await SQLite.openDatabaseAsync("axon_user.db");
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          attachments TEXT,
          metadata TEXT,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS rules (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          condition TEXT NOT NULL,
          action TEXT NOT NULL,
          message TEXT,
          priority INTEGER DEFAULT 0,
          enabled INTEGER DEFAULT 1,
          created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS skills (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          code TEXT NOT NULL,
          input_schema TEXT,
          output_schema TEXT,
          enabled INTEGER DEFAULT 1,
          created_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_messages_conversation
          ON messages(conversation_id);
      `);

      // Migrations (idempotent — ALTER TABLE fails silently if column exists)
      const migrations = [
        `ALTER TABLE rules ADD COLUMN content TEXT`,
        `ALTER TABLE skills ADD COLUMN content TEXT`,
        `ALTER TABLE conversations ADD COLUMN forked_from TEXT`,
        `ALTER TABLE conversations ADD COLUMN forked_at_message TEXT`,
        `ALTER TABLE conversations ADD COLUMN summary TEXT`,
      ];
      for (const sql of migrations) {
        try {
          await this.db.execAsync(`${sql};`);
        } catch {
          /* column already exists */
        }
      }

      // New tables (idempotent — CREATE IF NOT EXISTS)
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS memory_facts (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          source_conversation_id TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_memory_key ON memory_facts(key);
      `);

      AppLogger.info("LocalStore initialized", undefined, "LocalStore");
    } catch (error) {
      this.db = null;
      AppLogger.error("Failed to init LocalStore", error, "LocalStore");
      throw error;
    }
  }

  private async ensureDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) await this.init();
    if (!this.db) {
      throw new Error("LocalStore database failed to initialize");
    }
    return this.db;
  }

  // ─── Conversations ──────────────────────────────────────────
  async createConversation(title: string): Promise<LocalConversation> {
    const db = await this.ensureDb();
    const conv: LocalConversation = {
      id: uuid(),
      title,
      createdAt: Date.now(),
    };
    await db.runAsync(
      "INSERT INTO conversations (id, title, created_at) VALUES (?, ?, ?)",
      [conv.id, conv.title, conv.createdAt],
    );
    return conv;
  }

  async listConversations(): Promise<LocalConversation[]> {
    const db = await this.ensureDb();
    return db.getAllAsync<LocalConversation>(
      `SELECT id, title, created_at AS createdAt,
              forked_from AS forkedFrom, forked_at_message AS forkedAtMessage,
              summary
       FROM conversations ORDER BY created_at DESC`,
    );
  }

  async getConversation(id: string): Promise<LocalConversation | null> {
    const db = await this.ensureDb();
    return (
      (await db.getFirstAsync<LocalConversation>(
        `SELECT id, title, created_at AS createdAt,
                forked_from AS forkedFrom, forked_at_message AS forkedAtMessage,
                summary
         FROM conversations WHERE id = ?`,
        [id],
      )) ?? null
    );
  }

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const db = await this.ensureDb();
    await db.runAsync("UPDATE conversations SET title = ? WHERE id = ?", [
      title,
      id,
    ]);
  }

  async deleteConversation(id: string): Promise<void> {
    const db = await this.ensureDb();
    await db.runAsync("DELETE FROM messages WHERE conversation_id = ?", [id]);
    await db.runAsync("DELETE FROM conversations WHERE id = ?", [id]);
  }

  // ─── Messages ───────────────────────────────────────────────
  async addMessage(
    conversationId: string,
    role: "user" | "assistant",
    content: string,
    attachments?: unknown,
    metadata?: unknown,
  ): Promise<LocalMessage> {
    const db = await this.ensureDb();
    const msg: LocalMessage = {
      id: uuid(),
      conversationId,
      role,
      content,
      attachments: attachments ? JSON.stringify(attachments) : null,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: Date.now(),
    };
    await db.runAsync(
      "INSERT INTO messages (id, conversation_id, role, content, attachments, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        msg.id,
        msg.conversationId,
        msg.role,
        msg.content,
        msg.attachments,
        msg.metadata,
        msg.createdAt,
      ],
    );
    return msg;
  }

  async getMessages(conversationId: string): Promise<LocalMessage[]> {
    const db = await this.ensureDb();
    return db.getAllAsync<LocalMessage>(
      `SELECT id, conversation_id AS conversationId, role, content, attachments, metadata, created_at AS createdAt
       FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`,
      [conversationId],
    );
  }

  async getRecentHistory(
    conversationId: string,
    limit = 20,
  ): Promise<{ role: "user" | "assistant"; content: string }[]> {
    const db = await this.ensureDb();
    const rows = await db.getAllAsync<{ role: string; content: string }>(
      `SELECT role, content FROM messages
       WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`,
      [conversationId, limit],
    );
    return rows.reverse().map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content,
    }));
  }

  // ─── Fork & Regenerate ─────────────────────────────────────

  async forkConversation(
    convId: string,
    upToMessageId: string,
  ): Promise<LocalConversation> {
    const db = await this.ensureDb();
    const original = await this.getConversation(convId);
    const newConv: LocalConversation = {
      id: uuid(),
      title: `Fork: ${original?.title ?? "Chat"}`,
      createdAt: Date.now(),
      forkedFrom: convId,
      forkedAtMessage: upToMessageId,
    };
    await db.runAsync(
      `INSERT INTO conversations (id, title, created_at, forked_from, forked_at_message)
       VALUES (?, ?, ?, ?, ?)`,
      [
        newConv.id,
        newConv.title,
        newConv.createdAt,
        newConv.forkedFrom ?? null,
        newConv.forkedAtMessage ?? null,
      ],
    );

    // Copy messages up to and including the target message
    const allMsgs = await this.getMessages(convId);
    const idx = allMsgs.findIndex((m) => m.id === upToMessageId);
    const toCopy = idx >= 0 ? allMsgs.slice(0, idx + 1) : allMsgs;

    for (const m of toCopy) {
      await db.runAsync(
        `INSERT INTO messages (id, conversation_id, role, content, attachments, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid(),
          newConv.id,
          m.role,
          m.content,
          m.attachments,
          m.metadata,
          m.createdAt,
        ],
      );
    }
    return newConv;
  }

  async deleteLastAssistantMessage(conversationId: string): Promise<void> {
    const db = await this.ensureDb();
    const last = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM messages
       WHERE conversation_id = ? AND role = 'assistant'
       ORDER BY created_at DESC LIMIT 1`,
      [conversationId],
    );
    if (last) {
      await db.runAsync("DELETE FROM messages WHERE id = ?", [last.id]);
    }
  }

  async updateConversationSummary(id: string, summary: string): Promise<void> {
    const db = await this.ensureDb();
    await db.runAsync("UPDATE conversations SET summary = ? WHERE id = ?", [
      summary,
      id,
    ]);
  }

  async getConversationSummary(id: string): Promise<string | null> {
    const db = await this.ensureDb();
    const row = await db.getFirstAsync<{ summary: string | null }>(
      "SELECT summary FROM conversations WHERE id = ?",
      [id],
    );
    return row?.summary ?? null;
  }

  // ─── Memory Facts ─────────────────────────────────────────

  async saveMemoryFact(
    key: string,
    value: string,
    sourceConversationId?: string,
  ): Promise<MemoryFact> {
    const db = await this.ensureDb();
    const now = Date.now();

    // Upsert: if key exists, update value
    const existing = await db.getFirstAsync<{ id: string }>(
      "SELECT id FROM memory_facts WHERE key = ?",
      [key],
    );
    if (existing) {
      await db.runAsync(
        "UPDATE memory_facts SET value = ?, updated_at = ? WHERE id = ?",
        [value, now, existing.id],
      );
      return {
        id: existing.id,
        key,
        value,
        sourceConversationId: sourceConversationId ?? null,
        createdAt: now,
        updatedAt: now,
      };
    }

    const fact: MemoryFact = {
      id: uuid(),
      key,
      value,
      sourceConversationId: sourceConversationId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    await db.runAsync(
      `INSERT INTO memory_facts (id, key, value, source_conversation_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        fact.id,
        fact.key,
        fact.value,
        fact.sourceConversationId,
        fact.createdAt,
        fact.updatedAt,
      ],
    );
    return fact;
  }

  async getMemoryFacts(): Promise<MemoryFact[]> {
    const db = await this.ensureDb();
    return db.getAllAsync<MemoryFact>(
      `SELECT id, key, value, source_conversation_id AS sourceConversationId,
              created_at AS createdAt, updated_at AS updatedAt
       FROM memory_facts ORDER BY updated_at DESC`,
    );
  }

  async deleteMemoryFact(id: string): Promise<void> {
    const db = await this.ensureDb();
    await db.runAsync("DELETE FROM memory_facts WHERE id = ?", [id]);
  }

  // ─── Rules ──────────────────────────────────────────────────
  async createRule(rule: {
    name: string;
    description?: string;
    condition: string;
    action: string;
    message?: string;
    content?: string;
    priority?: number;
  }): Promise<LocalRule> {
    const db = await this.ensureDb();
    const r: LocalRule = {
      id: uuid(),
      name: rule.name,
      description: rule.description ?? null,
      condition: rule.condition,
      action: rule.action,
      message: rule.message ?? null,
      content: rule.content ?? null,
      priority: rule.priority ?? 0,
      enabled: 1,
      createdAt: Date.now(),
    };
    await db.runAsync(
      `INSERT INTO rules (id, name, description, condition, action, message, content, priority, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.name,
        r.description,
        r.condition,
        r.action,
        r.message,
        r.content,
        r.priority,
        r.enabled,
        r.createdAt,
      ],
    );
    return r;
  }

  async listRules(): Promise<LocalRule[]> {
    const db = await this.ensureDb();
    return db.getAllAsync<LocalRule>(
      `SELECT id, name, description, condition, action, message, content, priority, enabled, created_at AS createdAt
       FROM rules ORDER BY priority ASC, created_at DESC`,
    );
  }

  async updateRule(
    id: string,
    updates: Partial<
      Pick<
        LocalRule,
        | "name"
        | "description"
        | "condition"
        | "action"
        | "message"
        | "content"
        | "priority"
        | "enabled"
      >
    >,
  ): Promise<void> {
    const db = await this.ensureDb();
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, value] of Object.entries(updates)) {
      const col = key === "createdAt" ? "created_at" : key;
      sets.push(`${col} = ?`);
      vals.push(value);
    }
    if (sets.length === 0) return;
    vals.push(id);
    await db.runAsync(
      `UPDATE rules SET ${sets.join(", ")} WHERE id = ?`,
      vals as (string | number | null)[],
    );
  }

  async deleteRule(id: string): Promise<void> {
    const db = await this.ensureDb();
    await db.runAsync("DELETE FROM rules WHERE id = ?", [id]);
  }

  async getActiveRules(): Promise<LocalRule[]> {
    const db = await this.ensureDb();
    return db.getAllAsync<LocalRule>(
      `SELECT id, name, description, condition, action, message, content, priority, enabled, created_at AS createdAt
       FROM rules WHERE enabled = 1 ORDER BY priority ASC`,
    );
  }

  // ─── Skills ─────────────────────────────────────────────────
  async createSkill(skill: {
    name: string;
    description?: string;
    code: string;
    content?: string;
    inputSchema?: string;
    outputSchema?: string;
  }): Promise<LocalSkill> {
    const db = await this.ensureDb();
    const s: LocalSkill = {
      id: uuid(),
      name: skill.name,
      description: skill.description ?? null,
      code: skill.code,
      content: skill.content ?? null,
      inputSchema: skill.inputSchema ?? null,
      outputSchema: skill.outputSchema ?? null,
      enabled: 1,
      createdAt: Date.now(),
    };
    await db.runAsync(
      `INSERT INTO skills (id, name, description, code, content, input_schema, output_schema, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.name,
        s.description,
        s.code,
        s.content,
        s.inputSchema,
        s.outputSchema,
        s.enabled,
        s.createdAt,
      ],
    );
    return s;
  }

  async listSkills(): Promise<LocalSkill[]> {
    const db = await this.ensureDb();
    return db.getAllAsync<LocalSkill>(
      `SELECT id, name, description, code, content, input_schema AS inputSchema, output_schema AS outputSchema, enabled, created_at AS createdAt
       FROM skills ORDER BY created_at DESC`,
    );
  }

  async updateSkill(
    id: string,
    updates: Partial<
      Pick<
        LocalSkill,
        | "name"
        | "description"
        | "code"
        | "content"
        | "inputSchema"
        | "outputSchema"
        | "enabled"
      >
    >,
  ): Promise<void> {
    const db = await this.ensureDb();
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [key, value] of Object.entries(updates)) {
      const col =
        key === "inputSchema"
          ? "input_schema"
          : key === "outputSchema"
            ? "output_schema"
            : key === "createdAt"
              ? "created_at"
              : key;
      sets.push(`${col} = ?`);
      vals.push(value);
    }
    if (sets.length === 0) return;
    vals.push(id);
    await db.runAsync(
      `UPDATE skills SET ${sets.join(", ")} WHERE id = ?`,
      vals as (string | number | null)[],
    );
  }

  async deleteSkill(id: string): Promise<void> {
    const db = await this.ensureDb();
    await db.runAsync("DELETE FROM skills WHERE id = ?", [id]);
  }

  async getEnabledSkills(): Promise<LocalSkill[]> {
    const db = await this.ensureDb();
    return db.getAllAsync<LocalSkill>(
      `SELECT id, name, description, code, content, input_schema AS inputSchema, output_schema AS outputSchema, enabled, created_at AS createdAt
       FROM skills WHERE enabled = 1`,
    );
  }
}

export const localStore = new LocalStore();
