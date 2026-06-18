import sqlite3
import os


def get_db_path():
    appdata = os.environ.get('APPDATA', os.path.expanduser('~'))
    db_dir = os.path.join(appdata, 'task-assistant')
    os.makedirs(db_dir, exist_ok=True)
    return os.path.join(db_dir, 'task-assistant.db')


def init_db():
    path = get_db_path()
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")

    conn.executescript("""
        CREATE TABLE IF NOT EXISTS raw_messages (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL CHECK(source IN ('wechat', 'qq')),
            sender TEXT NOT NULL DEFAULT '',
            group_name TEXT,
            content TEXT NOT NULL DEFAULT '',
            context_json TEXT,
            captured_at TEXT NOT NULL DEFAULT (datetime('now')),
            processed INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            priority TEXT NOT NULL DEFAULT 'medium',
            deadline TEXT,
            source TEXT NOT NULL,
            sender TEXT NOT NULL DEFAULT '',
            group_name TEXT,
            source_message_id TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            confidence REAL NOT NULL DEFAULT 0.5,
            context_missing INTEGER NOT NULL DEFAULT 0,
            sort_order REAL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS executions (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            level TEXT NOT NULL,
            main_model TEXT NOT NULL DEFAULT '',
            reference_models TEXT NOT NULL DEFAULT '[]',
            result_json TEXT NOT NULL DEFAULT '{}',
            files TEXT NOT NULL DEFAULT '[]',
            duration_ms INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ai_config (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL UNIQUE,
            api_key_encrypted TEXT NOT NULL DEFAULT '',
            endpoint TEXT NOT NULL DEFAULT '',
            enabled INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            linked_task_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    return conn


def get_connection():
    return sqlite3.connect(get_db_path())
