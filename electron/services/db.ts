import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

let db: SqlJsDatabase;
const DB_FILENAME = 'task-assistant.db';

function getDbPath(): string {
  return path.join(app.getPath('userData'), DB_FILENAME);
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(getDbPath(), Buffer.from(data));
}

export async function initDatabase(): Promise<SqlJsDatabase> {
  const dbPath = getDbPath();
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys=ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS raw_messages (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL DEFAULT 'manual',
      sender TEXT NOT NULL DEFAULT '',
      group_name TEXT,
      content TEXT NOT NULL DEFAULT '',
      context_json TEXT,
      captured_at TEXT NOT NULL DEFAULT (datetime('now')),
      processed INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
      deadline TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      sender TEXT NOT NULL DEFAULT '',
      group_name TEXT,
      source_message_id TEXT REFERENCES raw_messages(id),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
      confidence REAL NOT NULL DEFAULT 0.5,
      context_missing INTEGER NOT NULL DEFAULT 0,
      sort_order REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS executions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      level TEXT NOT NULL CHECK(level IN ('L1', 'L2', 'L3')),
      main_model TEXT NOT NULL DEFAULT '',
      reference_models TEXT NOT NULL DEFAULT '[]',
      result_json TEXT NOT NULL DEFAULT '{}',
      files TEXT NOT NULL DEFAULT '[]',
      duration_ms INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('running', 'completed', 'failed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL UNIQUE,
      api_key_encrypted TEXT NOT NULL DEFAULT '',
      endpoint TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS anonymize_rules (
      id TEXT PRIMARY KEY,
      rule_type TEXT NOT NULL,
      replacement TEXT NOT NULL DEFAULT '[REDACTED]',
      pattern TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      linked_task_id TEXT REFERENCES tasks(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Migration: fix CHECK(source IN ('wechat','qq')) left by old Python schema
  const taskTable = queryOne("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'");
  if (taskTable && typeof taskTable.sql === 'string' && taskTable.sql.includes("CHECK(source IN ('wechat', 'qq'))")) {
    db.run(`
      CREATE TABLE tasks_migrated (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
        deadline TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        sender TEXT NOT NULL DEFAULT '',
        group_name TEXT,
        source_message_id TEXT REFERENCES raw_messages(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
        confidence REAL NOT NULL DEFAULT 0.5,
        context_missing INTEGER NOT NULL DEFAULT 0,
        sort_order REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    db.run('INSERT INTO tasks_migrated SELECT * FROM tasks');
    db.run('DROP TABLE tasks');
    db.run('ALTER TABLE tasks_migrated RENAME TO tasks');
    console.log('[DB] Migrated tasks table: removed old CHECK(source) constraint');
  }

  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at)');
  db.run('CREATE INDEX IF NOT EXISTS idx_messages_processed ON raw_messages(processed)');
  db.run('CREATE INDEX IF NOT EXISTS idx_notes_task ON notes(linked_task_id)');

  saveDb();
  return db;
}

export function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function execute(sql: string, params: unknown[] = []): void {
  db.run(sql, params);
  saveDb();
}

export function persist(): void {
  saveDb();
}
