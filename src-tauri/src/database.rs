use rusqlite::{Connection, Result as SqliteResult, params};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use chrono::Utc;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub mode: String,
    pub model: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Entry {
    pub id: String,
    pub session_id: String,
    pub version_number: i64,
    pub raw_input: String,
    pub generated_prompt: String,
    pub token_usage_prompt: i64,
    pub token_usage_completion: i64,
    pub pinned: bool,
    pub status: String,
    pub created_at: String,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_data_dir: &std::path::Path) -> SqliteResult<Self> {
        std::fs::create_dir_all(app_data_dir).ok();
        let db_path = app_data_dir.join("history.db");
        let conn = Connection::open(db_path)?;

        // Fix #4: enable FK enforcement on this connection (not just at schema init)
        conn.execute("PRAGMA foreign_keys = ON", [])?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                mode TEXT NOT NULL,
                model TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                version_number INTEGER NOT NULL DEFAULT 1,
                raw_input TEXT NOT NULL,
                generated_prompt TEXT NOT NULL DEFAULT '',
                token_usage_prompt INTEGER NOT NULL DEFAULT 0,
                token_usage_completion INTEGER NOT NULL DEFAULT 0,
                pinned INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'complete',
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_entries_session ON entries(session_id);"
        )?;

        Ok(Database {
            conn: Mutex::new(conn),
        })
    }

    pub fn create_session(&self, id: &str, title: &str, mode: &str, model: &str) -> SqliteResult<Session> {
        let now = Utc::now().to_rfc3339();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO sessions (id, title, mode, model, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, title, mode, model, &now, &now],
        )?;
        Ok(Session {
            id: id.to_string(),
            title: title.to_string(),
            mode: mode.to_string(),
            model: model.to_string(),
            created_at: now.clone(),
            updated_at: now,
        })
    }

    pub fn list_sessions(&self) -> SqliteResult<Vec<Session>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, title, mode, model, created_at, updated_at FROM sessions ORDER BY updated_at DESC"
        )?;
        let sessions = stmt.query_map([], |row| {
            Ok(Session {
                id: row.get(0)?,
                title: row.get(1)?,
                mode: row.get(2)?,
                model: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;
        Ok(sessions)
    }

    pub fn update_session_title(&self, id: &str, title: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, &Utc::now().to_rfc3339(), id],
        )?;
        Ok(())
    }

    pub fn delete_session(&self, id: &str) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        // Fix #4: ON DELETE CASCADE handles entries automatically; no manual delete needed
        conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn next_version_number(&self, session_id: &str) -> SqliteResult<i64> {
        let conn = self.conn.lock().unwrap();
        let max: Option<i64> = conn.query_row(
            "SELECT MAX(version_number) FROM entries WHERE session_id = ?1",
            params![session_id],
            |row| row.get(0),
        )?;
        Ok(max.unwrap_or(0) + 1)
    }

    pub fn get_latest_entry(&self, session_id: &str) -> SqliteResult<Option<Entry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, version_number, raw_input, generated_prompt, token_usage_prompt, token_usage_completion, pinned, status, created_at
             FROM entries WHERE session_id = ?1 ORDER BY version_number DESC LIMIT 1"
        )?;
        let mut entries = stmt.query_map(params![session_id], |row| {
            Ok(Entry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                version_number: row.get(2)?,
                raw_input: row.get(3)?,
                generated_prompt: row.get(4)?,
                token_usage_prompt: row.get(5)?,
                token_usage_completion: row.get(6)?,
                pinned: row.get::<_, i32>(7)? != 0,
                status: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;
        Ok(entries.pop())
    }

    pub fn add_entry(&self, entry: &Entry) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO entries (id, session_id, version_number, raw_input, generated_prompt, token_usage_prompt, token_usage_completion, pinned, status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                entry.id,
                entry.session_id,
                entry.version_number,
                entry.raw_input,
                entry.generated_prompt,
                entry.token_usage_prompt,
                entry.token_usage_completion,
                entry.pinned as i32,
                entry.status,
                entry.created_at,
            ],
        )?;
        conn.execute(
            "UPDATE sessions SET updated_at = ?1 WHERE id = ?2",
            params![&entry.created_at, &entry.session_id],
        )?;
        Ok(())
    }

    pub fn update_entry_prompt(&self, entry_id: &str, prompt: &str, status: &str, tokens_prompt: i64, tokens_completion: i64) -> SqliteResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE entries SET generated_prompt = ?1, status = ?2, token_usage_prompt = ?3, token_usage_completion = ?4 WHERE id = ?5",
            params![prompt, status, tokens_prompt, tokens_completion, entry_id],
        )?;
        Ok(())
    }

    pub fn get_session_entries(&self, session_id: &str) -> SqliteResult<Vec<Entry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, version_number, raw_input, generated_prompt, token_usage_prompt, token_usage_completion, pinned, status, created_at
             FROM entries WHERE session_id = ?1 ORDER BY version_number ASC"
        )?;
        let entries = stmt.query_map(params![session_id], |row| {
            Ok(Entry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                version_number: row.get(2)?,
                raw_input: row.get(3)?,
                generated_prompt: row.get(4)?,
                token_usage_prompt: row.get(5)?,
                token_usage_completion: row.get(6)?,
                pinned: row.get::<_, i32>(7)? != 0,
                status: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;
        Ok(entries)
    }

    pub fn toggle_pin(&self, entry_id: &str) -> SqliteResult<bool> {
        let conn = self.conn.lock().unwrap();
        let current: i32 = conn.query_row(
            "SELECT pinned FROM entries WHERE id = ?1",
            params![entry_id],
            |row| row.get(0),
        )?;
        let new_val = if current == 0 { 1 } else { 0 };
        conn.execute(
            "UPDATE entries SET pinned = ?1 WHERE id = ?2",
            params![new_val, entry_id],
        )?;
        Ok(new_val != 0)
    }

    pub fn get_pinned_entries(&self) -> SqliteResult<Vec<Entry>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, version_number, raw_input, generated_prompt, token_usage_prompt, token_usage_completion, pinned, status, created_at
             FROM entries WHERE pinned = 1 ORDER BY created_at DESC"
        )?;
        let entries = stmt.query_map([], |row| {
            Ok(Entry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                version_number: row.get(2)?,
                raw_input: row.get(3)?,
                generated_prompt: row.get(4)?,
                token_usage_prompt: row.get(5)?,
                token_usage_completion: row.get(6)?,
                pinned: row.get::<_, i32>(7)? != 0,
                status: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;
        Ok(entries)
    }

    pub fn search_entries(&self, query: &str) -> SqliteResult<Vec<Entry>> {
        let conn = self.conn.lock().unwrap();
        let pattern = format!("%{}%", query);
        let mut stmt = conn.prepare(
            "SELECT id, session_id, version_number, raw_input, generated_prompt, token_usage_prompt, token_usage_completion, pinned, status, created_at
             FROM entries WHERE raw_input LIKE ?1 OR generated_prompt LIKE ?1 ORDER BY created_at DESC LIMIT 50"
        )?;
        let entries = stmt.query_map(params![pattern], |row| {
            Ok(Entry {
                id: row.get(0)?,
                session_id: row.get(1)?,
                version_number: row.get(2)?,
                raw_input: row.get(3)?,
                generated_prompt: row.get(4)?,
                token_usage_prompt: row.get(5)?,
                token_usage_completion: row.get(6)?,
                pinned: row.get::<_, i32>(7)? != 0,
                status: row.get(8)?,
                created_at: row.get(9)?,
            })
        })?.collect::<SqliteResult<Vec<_>>>()?;
        Ok(entries)
    }
}
