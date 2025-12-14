use anyhow::Result;

use rusqlite::Connection;

pub fn create_tables(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        -- OAuth設定
        CREATE TABLE IF NOT EXISTS oauth_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            client_id TEXT NOT NULL,
            client_secret TEXT NOT NULL,
            redirect_uri TEXT NOT NULL DEFAULT 'http://localhost:8234/callback'
        );

        -- アカウント
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            access_token TEXT,
            refresh_token TEXT,
            token_expires_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- グループ
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            avatar_color TEXT NOT NULL DEFAULT '#4caf50',
            is_pinned INTEGER NOT NULL DEFAULT 0,
            notify_enabled INTEGER NOT NULL DEFAULT 1,
            is_hidden INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- グループメンバー
        CREATE TABLE IF NOT EXISTS group_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            display_name TEXT,
            UNIQUE(group_id, email)
        );

        -- メッセージ
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            uid INTEGER NOT NULL,
            message_id TEXT UNIQUE,
            group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
            from_email TEXT NOT NULL,
            from_name TEXT,
            to_email TEXT,
            subject TEXT,
            body_text TEXT,
            body_html TEXT,
            received_at TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            is_sent INTEGER NOT NULL DEFAULT 0,
            folder TEXT NOT NULL DEFAULT 'INBOX'
        );

        -- 添付ファイル
        CREATE TABLE IF NOT EXISTS attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            mime_type TEXT,
            size INTEGER NOT NULL DEFAULT 0,
            local_path TEXT
        );

        -- 設定
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            notifications_enabled INTEGER NOT NULL DEFAULT 1,
            sound_enabled INTEGER NOT NULL DEFAULT 1,
            sync_interval_minutes INTEGER NOT NULL DEFAULT 5,
            launch_at_login INTEGER NOT NULL DEFAULT 0,
            minimize_to_tray INTEGER NOT NULL DEFAULT 1,
            download_path TEXT NOT NULL DEFAULT 'downloads',
            download_custom_path TEXT
        );

        -- デフォルト設定を挿入
        INSERT OR IGNORE INTO settings (id) VALUES (1);

        -- インデックス
        CREATE INDEX IF NOT EXISTS idx_messages_group_id ON messages(group_id);
        CREATE INDEX IF NOT EXISTS idx_messages_received_at ON messages(received_at);
        CREATE INDEX IF NOT EXISTS idx_messages_from_email ON messages(from_email);
        CREATE INDEX IF NOT EXISTS idx_group_members_email ON group_members(email);
        CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments(message_id);
        "#,
    )?;

    // マイグレーション: is_hiddenカラムを追加
    let count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('groups') WHERE name = 'is_hidden'",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    if count == 0 {
        conn.execute("ALTER TABLE groups ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0", [])?;
    }

    Ok(())
}
