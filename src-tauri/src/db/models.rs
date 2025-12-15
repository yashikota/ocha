use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

// ============================================================================
// OAuth Config
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

impl OAuthConfig {
    pub fn get(conn: &Connection) -> Result<Option<Self>> {
        let mut stmt = conn.prepare(
            "SELECT client_id, client_secret, redirect_uri FROM oauth_config WHERE id = 1",
        )?;

        let config = stmt
            .query_row([], |row| {
                Ok(OAuthConfig {
                    client_id: row.get(0)?,
                    client_secret: row.get(1)?,
                    redirect_uri: row.get(2)?,
                })
            })
            .optional()?;

        Ok(config)
    }

    pub fn save(conn: &Connection, config: &OAuthConfig) -> Result<()> {
        conn.execute(
            r#"
            INSERT INTO oauth_config (id, client_id, client_secret, redirect_uri)
            VALUES (1, ?1, ?2, ?3)
            ON CONFLICT(id) DO UPDATE SET
                client_id = excluded.client_id,
                client_secret = excluded.client_secret,
                redirect_uri = excluded.redirect_uri
            "#,
            params![config.client_id, config.client_secret, config.redirect_uri],
        )?;
        Ok(())
    }

    pub fn delete(conn: &Connection) -> Result<()> {
        conn.execute("DELETE FROM oauth_config WHERE id = 1", [])?;
        Ok(())
    }
}

// ============================================================================
// Account
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: i64,
    pub email: String,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub token_expires_at: Option<String>,
    pub created_at: String,
}

impl Account {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Account {
            id: row.get(0)?,
            email: row.get(1)?,
            access_token: row.get(2)?,
            refresh_token: row.get(3)?,
            token_expires_at: row.get(4)?,
            created_at: row.get(5)?,
        })
    }

    pub fn get(conn: &Connection) -> Result<Option<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, email, access_token, refresh_token, token_expires_at, created_at
             FROM accounts LIMIT 1",
        )?;

        let account = stmt.query_row([], Self::from_row).optional()?;
        Ok(account)
    }

    pub fn save(conn: &Connection, email: &str, access_token: &str, refresh_token: &str, expires_at: &str) -> Result<i64> {
        conn.execute(
            r#"
            INSERT INTO accounts (email, access_token, refresh_token, token_expires_at)
            VALUES (?1, ?2, ?3, ?4)
            ON CONFLICT(email) DO UPDATE SET
                access_token = excluded.access_token,
                refresh_token = excluded.refresh_token,
                token_expires_at = excluded.token_expires_at
            "#,
            params![email, access_token, refresh_token, expires_at],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn delete(conn: &Connection, id: i64) -> Result<()> {
        conn.execute("DELETE FROM accounts WHERE id = ?1", params![id])?;
        Ok(())
    }
}

// ============================================================================
// Group
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: i64,
    pub name: String,
    pub avatar_color: String,
    pub is_pinned: bool,
    pub notify_enabled: bool,
    pub is_hidden: bool,
    pub tab_id: Option<i64>,
    pub created_at: String,
}

impl Group {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Group {
            id: row.get(0)?,
            name: row.get(1)?,
            avatar_color: row.get(2)?,
            is_pinned: row.get::<_, i32>(3)? != 0,
            notify_enabled: row.get::<_, i32>(4)? != 0,
            is_hidden: row.get::<_, i32>(5)? != 0,
            tab_id: row.get(6)?,
            created_at: row.get(7)?,
        })
    }

    pub fn list(conn: &Connection) -> Result<Vec<Self>> {
        // 最新メッセージ順にソート（ピン留めを優先）
        let mut stmt = conn.prepare(
            r#"
            SELECT g.id, g.name, g.avatar_color, g.is_pinned, g.notify_enabled, g.is_hidden, g.tab_id, g.created_at
            FROM groups g
            LEFT JOIN (
                SELECT group_id, MAX(received_at) as latest
                FROM messages
                GROUP BY group_id
            ) m ON g.id = m.group_id
            ORDER BY g.is_pinned DESC, m.latest DESC NULLS LAST, g.created_at DESC
            "#,
        )?;

        let groups = stmt
            .query_map([], Self::from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(groups)
    }

    pub fn get(conn: &Connection, id: i64) -> Result<Option<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, name, avatar_color, is_pinned, notify_enabled, is_hidden, tab_id, created_at FROM groups WHERE id = ?1",
        )?;

        let group = stmt.query_row(params![id], Self::from_row).optional()?;
        Ok(group)
    }

    pub fn create(conn: &Connection, name: &str, avatar_color: &str) -> Result<i64> {
        conn.execute(
            "INSERT INTO groups (name, avatar_color) VALUES (?1, ?2)",
            params![name, avatar_color],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update(conn: &Connection, id: i64, name: &str, avatar_color: &str, is_pinned: bool, notify_enabled: bool, is_hidden: bool, tab_id: Option<i64>) -> Result<()> {
        conn.execute(
            "UPDATE groups SET name = ?1, avatar_color = ?2, is_pinned = ?3, notify_enabled = ?4, is_hidden = ?5, tab_id = ?6 WHERE id = ?7",
            params![name, avatar_color, is_pinned as i32, notify_enabled as i32, is_hidden as i32, tab_id, id],
        )?;
        Ok(())
    }

    pub fn delete(conn: &Connection, id: i64) -> Result<()> {
        conn.execute("DELETE FROM groups WHERE id = ?1", params![id])?;
        Ok(())
    }

    /// グループを統合（source_idのメンバーとメッセージをtarget_idに移動し、source_idを削除）
    pub fn merge(conn: &Connection, target_id: i64, source_id: i64) -> Result<()> {
        // source_idのメッセージをtarget_idに移動
        conn.execute(
            "UPDATE messages SET group_id = ?1 WHERE group_id = ?2",
            params![target_id, source_id],
        )?;

        // source_idのメンバーをtarget_idに移動（重複は無視）
        conn.execute(
            r#"
            INSERT OR IGNORE INTO group_members (group_id, email, display_name)
            SELECT ?1, email, display_name FROM group_members WHERE group_id = ?2
            "#,
            params![target_id, source_id],
        )?;

        // source_idを削除（group_membersはCASCADE削除される）
        conn.execute("DELETE FROM groups WHERE id = ?1", params![source_id])?;

        Ok(())
    }

    /// グループを分割（指定したメールアドレスを新しいグループに移動）
    pub fn split(conn: &Connection, source_id: i64, emails: &[String], new_group_name: &str) -> Result<i64> {
        // 新しいグループを作成
        let color = generate_color_from_email(&emails.join(","));
        let new_group_id = Self::create(conn, new_group_name, &color)?;

        for email in emails {
            // メンバーを新しいグループに移動
            let display_name: Option<String> = conn
                .query_row(
                    "SELECT display_name FROM group_members WHERE group_id = ?1 AND email = ?2",
                    params![source_id, email],
                    |row| row.get(0),
                )
                .ok();

            GroupMember::add(conn, new_group_id, email, display_name.as_deref())?;
            GroupMember::remove(conn, source_id, email)?;

            // メッセージを新しいグループに移動（from_emailまたはto_emailがこのアドレスのもの）
            conn.execute(
                "UPDATE messages SET group_id = ?1 WHERE group_id = ?2 AND (from_email = ?3 OR to_email = ?3)",
                params![new_group_id, source_id, email],
            )?;
        }

        Ok(new_group_id)
    }

    /// メールアドレスからグループを検索
    pub fn find_by_email(conn: &Connection, email: &str) -> Result<Option<Self>> {
        let mut stmt = conn.prepare(
            r#"
            SELECT g.id, g.name, g.avatar_color, g.is_pinned, g.notify_enabled, g.is_hidden, g.tab_id, g.created_at
            FROM groups g
            INNER JOIN group_members gm ON g.id = gm.group_id
            WHERE gm.email = ?1
            LIMIT 1
            "#,
        )?;

        let group = stmt.query_row(params![email], Self::from_row).optional()?;
        Ok(group)
    }

    /// 新しい送信者のためにグループを自動作成
    pub fn create_for_email(conn: &Connection, email: &str, display_name: Option<&str>) -> Result<i64> {
        let name = display_name.unwrap_or(email);
        let color = generate_color_from_email(email);

        let group_id = Self::create(conn, name, &color)?;
        GroupMember::add(conn, group_id, email, display_name)?;

        Ok(group_id)
    }
}

/// メールアドレスからアバターカラーを生成
fn generate_color_from_email(email: &str) -> String {
    let colors = [
        "#2e7d32", "#1565c0", "#6a1b9a", "#c62828", "#ef6c00",
        "#00838f", "#558b2f", "#4527a0", "#ad1457", "#00695c",
    ];

    let hash: u32 = email.bytes().fold(0, |acc, b| acc.wrapping_add(b as u32));
    let index = (hash as usize) % colors.len();
    colors[index].to_string()
}

// ============================================================================
// Group Member
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupMember {
    pub id: i64,
    pub group_id: i64,
    pub email: String,
    pub display_name: Option<String>,
}

impl GroupMember {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(GroupMember {
            id: row.get(0)?,
            group_id: row.get(1)?,
            email: row.get(2)?,
            display_name: row.get(3)?,
        })
    }

    pub fn list_by_group(conn: &Connection, group_id: i64) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, group_id, email, display_name FROM group_members WHERE group_id = ?1",
        )?;

        let members = stmt
            .query_map(params![group_id], Self::from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(members)
    }

    pub fn add(conn: &Connection, group_id: i64, email: &str, display_name: Option<&str>) -> Result<i64> {
        conn.execute(
            "INSERT OR IGNORE INTO group_members (group_id, email, display_name) VALUES (?1, ?2, ?3)",
            params![group_id, email, display_name],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn remove(conn: &Connection, group_id: i64, email: &str) -> Result<()> {
        conn.execute(
            "DELETE FROM group_members WHERE group_id = ?1 AND email = ?2",
            params![group_id, email],
        )?;
        Ok(())
    }
}

// ============================================================================
// Message
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub id: i64,
    pub uid: i64,
    pub message_id: Option<String>,
    pub group_id: Option<i64>,
    pub from_email: String,
    pub from_name: Option<String>,
    pub to_email: Option<String>,
    pub subject: Option<String>,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub received_at: String,
    pub is_read: bool,
    pub is_sent: bool,
    pub folder: String,
    #[serde(default)]
    pub is_bookmarked: bool,
    #[serde(default)]
    pub attachments: Vec<Attachment>,
}

impl Message {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Message {
            id: row.get(0)?,
            uid: row.get(1)?,
            message_id: row.get(2)?,
            group_id: row.get(3)?,
            from_email: row.get(4)?,
            from_name: row.get(5)?,
            to_email: row.get(6)?,
            subject: row.get(7)?,
            body_text: row.get(8)?,
            body_html: row.get(9)?,
            received_at: row.get(10)?,
            is_read: row.get::<_, i32>(11)? != 0,
            is_sent: row.get::<_, i32>(12)? != 0,
            folder: row.get(13)?,
            is_bookmarked: row.get::<_, i32>(14)? != 0,
            attachments: vec![],
        })
    }

    pub fn list_by_group(conn: &Connection, group_id: i64) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare(
            r#"
            SELECT id, uid, message_id, group_id, from_email, from_name, to_email,
                   subject, body_text, body_html, received_at, is_read, is_sent, folder, is_bookmarked
            FROM messages
            WHERE group_id = ?1
            ORDER BY received_at ASC
            "#,
        )?;

        let mut messages = stmt
            .query_map(params![group_id], Self::from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        // 添付ファイルを取得
        for msg in &mut messages {
            msg.attachments = Attachment::list_by_message(conn, msg.id)?;
        }

        Ok(messages)
    }

    pub fn get_latest_uid(conn: &Connection, folder: &str) -> Result<i64> {
        let uid: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(uid), 0) FROM messages WHERE folder = ?1",
                params![folder],
                |row| row.get(0),
            )?;
        Ok(uid)
    }

    pub fn exists_by_message_id(conn: &Connection, message_id: &str) -> Result<bool> {
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM messages WHERE message_id = ?1",
            params![message_id],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn insert(conn: &Connection, msg: &NewMessage) -> Result<i64> {
        conn.execute(
            r#"
            INSERT OR IGNORE INTO messages (uid, message_id, group_id, from_email, from_name, to_email,
                                  subject, body_text, body_html, received_at, is_sent, folder, is_read)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            "#,
            params![
                msg.uid,
                msg.message_id,
                msg.group_id,
                msg.from_email,
                msg.from_name,
                msg.to_email,
                msg.subject,
                msg.body_text,
                msg.body_html,
                msg.received_at,
                msg.is_sent,
                msg.folder,
                msg.is_read as i32,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get(conn: &Connection, id: i64) -> Result<Option<Self>> {
        let mut stmt = conn.prepare(
            r#"
            SELECT id, uid, message_id, group_id, from_email, from_name, to_email,
                   subject, body_text, body_html, received_at, is_read, is_sent, folder, is_bookmarked
            FROM messages
            WHERE id = ?1
            "#,
        )?;

        let message = stmt.query_row(params![id], Self::from_row).optional()?;
        Ok(message)
    }

    pub fn mark_as_read(conn: &Connection, id: i64) -> Result<()> {
        conn.execute("UPDATE messages SET is_read = 1 WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn mark_group_as_read(conn: &Connection, group_id: i64) -> Result<()> {
        conn.execute("UPDATE messages SET is_read = 1 WHERE group_id = ?1", params![group_id])?;
        Ok(())
    }

    pub fn get_unread_counts(conn: &Connection) -> Result<Vec<(i64, i64)>> {
        let mut stmt = conn.prepare(
            "SELECT group_id, COUNT(*) FROM messages WHERE is_read = 0 AND group_id IS NOT NULL GROUP BY group_id",
        )?;

        let counts = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(counts)
    }

    pub fn toggle_bookmark(conn: &Connection, id: i64) -> Result<bool> {
        // 現在の状態を取得
        let current: i32 = conn.query_row(
            "SELECT is_bookmarked FROM messages WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;

        let new_state = if current == 0 { 1 } else { 0 };

        conn.execute(
            "UPDATE messages SET is_bookmarked = ?1 WHERE id = ?2",
            params![new_state, id],
        )?;

        Ok(new_state != 0)
    }

    pub fn list_bookmarks(conn: &Connection) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare(
            r#"
            SELECT id, uid, message_id, group_id, from_email, from_name, to_email,
                   subject, body_text, body_html, received_at, is_read, is_sent, folder, is_bookmarked
            FROM messages
            WHERE is_bookmarked = 1
            ORDER BY received_at DESC
            "#,
        )?;

        let mut messages = stmt
            .query_map([], Self::from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        // 添付ファイルを取得
        for msg in &mut messages {
            msg.attachments = Attachment::list_by_message(conn, msg.id)?;
        }

        Ok(messages)
    }

    pub fn search(
        conn: &Connection,
        query: &str,
        group_id: Option<i64>,
    ) -> Result<Vec<Self>> {
        let pattern = format!("%{}%", query);
        let mut sql = String::from(
            r#"
            SELECT id, uid, message_id, group_id, from_email, from_name, to_email,
                   subject, body_text, body_html, received_at, is_read, is_sent, folder, is_bookmarked
            FROM messages
            WHERE (subject LIKE ?1 OR body_text LIKE ?1 OR from_name LIKE ?1 OR from_email LIKE ?1)
            "#,
        );

        if group_id.is_some() {
            sql.push_str(" AND group_id = ?2");
        }

        sql.push_str(" ORDER BY received_at DESC");

        let mut stmt = conn.prepare(&sql)?;

        let rows = if let Some(gid) = group_id {
             stmt.query_map(params![&pattern, gid], Self::from_row)?
        } else {
             stmt.query_map(params![&pattern], Self::from_row)?
        };

        let mut messages = rows.collect::<rusqlite::Result<Vec<_>>>()?;

        // 添付ファイルを取得
        for msg in &mut messages {
            msg.attachments = Attachment::list_by_message(conn, msg.id)?;
        }

        Ok(messages)
    }
}

#[derive(Debug, Clone)]
pub struct NewMessage {
    pub uid: i64,
    pub message_id: Option<String>,
    pub group_id: Option<i64>,
    pub from_email: String,
    pub from_name: Option<String>,
    pub to_email: Option<String>,
    pub subject: Option<String>,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub received_at: String,
    pub is_sent: bool,
    pub folder: String,
    pub is_read: bool,
}

// ============================================================================
// Attachment
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: i64,
    pub message_id: i64,
    pub filename: String,
    pub mime_type: Option<String>,
    pub size: i64,
    pub local_path: Option<String>,
}

impl Attachment {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Attachment {
            id: row.get(0)?,
            message_id: row.get(1)?,
            filename: row.get(2)?,
            mime_type: row.get(3)?,
            size: row.get(4)?,
            local_path: row.get(5)?,
        })
    }

    pub fn list_by_message(conn: &Connection, message_id: i64) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, message_id, filename, mime_type, size, local_path FROM attachments WHERE message_id = ?1",
        )?;

        let attachments = stmt
            .query_map(params![message_id], Self::from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;

        Ok(attachments)
    }

    pub fn insert(conn: &Connection, message_id: i64, filename: &str, mime_type: Option<&str>, size: i64) -> Result<i64> {
        conn.execute(
            "INSERT INTO attachments (message_id, filename, mime_type, size) VALUES (?1, ?2, ?3, ?4)",
            params![message_id, filename, mime_type, size],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_local_path(conn: &Connection, id: i64, local_path: &str) -> Result<()> {
        conn.execute(
            "UPDATE attachments SET local_path = ?1 WHERE id = ?2",
            params![local_path, id],
        )?;
        Ok(())
    }

    pub fn get(conn: &Connection, id: i64) -> Result<Option<Self>> {
        let mut stmt = conn.prepare(
            "SELECT id, message_id, filename, mime_type, size, local_path FROM attachments WHERE id = ?1",
        )?;

        let attachment = stmt.query_row(params![id], Self::from_row).optional()?;
        Ok(attachment)
    }
}

// ============================================================================
// Settings
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub notifications_enabled: bool,
    pub sound_enabled: bool,
    pub sync_interval_minutes: i32,
    pub launch_at_login: bool,
    pub minimize_to_tray: bool,
    pub download_path: String,
    pub download_custom_path: Option<String>,
    pub auto_mark_as_read: bool,
}

impl Settings {
    pub fn get(conn: &Connection) -> Result<Self> {
        let settings = conn.query_row(
            "SELECT notifications_enabled, sound_enabled, sync_interval_minutes, launch_at_login, minimize_to_tray, download_path, download_custom_path, auto_mark_as_read FROM settings WHERE id = 1",
            [],
            |row| {
                Ok(Settings {
                    notifications_enabled: row.get::<_, i32>(0)? != 0,
                    sound_enabled: row.get::<_, i32>(1)? != 0,
                    sync_interval_minutes: row.get(2)?,
                    launch_at_login: row.get::<_, i32>(3)? != 0,
                    minimize_to_tray: row.get::<_, i32>(4)? != 0,
                    download_path: row.get(5)?,
                    download_custom_path: row.get(6)?,
                    auto_mark_as_read: row.get::<_, i32>(7)? != 0,
                })
            },
        )?;
        Ok(settings)
    }

    pub fn save(conn: &Connection, settings: &Settings) -> Result<()> {
        conn.execute(
            r#"
            UPDATE settings SET
                notifications_enabled = ?1,
                sound_enabled = ?2,
                sync_interval_minutes = ?3,
                launch_at_login = ?4,
                minimize_to_tray = ?5,
                download_path = ?6,
                download_custom_path = ?7,
                auto_mark_as_read = ?8
            WHERE id = 1
            "#,
            params![
                settings.notifications_enabled as i32,
                settings.sound_enabled as i32,
                settings.sync_interval_minutes,
                settings.launch_at_login as i32,
                settings.minimize_to_tray as i32,
                settings.download_path,
                settings.download_custom_path,
                settings.auto_mark_as_read as i32,
            ],
        )?;
        Ok(())
    }
}
