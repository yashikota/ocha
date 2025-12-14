use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    pub id: i64,
    pub name: String,
    pub sort_order: i32,
}

impl Tab {
    fn from_row(row: &Row) -> rusqlite::Result<Self> {
        Ok(Tab {
            id: row.get(0)?,
            name: row.get(1)?,
            sort_order: row.get(2)?,
        })
    }

    pub fn list(conn: &Connection) -> Result<Vec<Self>> {
        let mut stmt = conn.prepare("SELECT id, name, sort_order FROM tabs ORDER BY sort_order ASC")?;
        let tabs = stmt
            .query_map([], Self::from_row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(tabs)
    }

    pub fn create(conn: &Connection, name: &str) -> Result<i64> {
        // 重複チェックはUI側で行うか、必要ならここでUNIQUE制約を追加するが、
        // ユーザーが同じ名前のタブを作りたい場合もあるかもしれないので、とりあえず許可。
        // sort_orderは現在の最大値+1にする
        let max_order: i32 = conn.query_row(
            "SELECT COALESCE(MAX(sort_order), 0) FROM tabs",
            [],
            |row| row.get(0),
        )?;

        conn.execute(
            "INSERT INTO tabs (name, sort_order) VALUES (?1, ?2)",
            params![name, max_order + 1],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update(conn: &Connection, id: i64, name: &str) -> Result<()> {
        conn.execute(
            "UPDATE tabs SET name = ?1 WHERE id = ?2",
            params![name, id],
        )?;
        Ok(())
    }

    pub fn delete(conn: &Connection, id: i64) -> Result<()> {
        conn.execute("DELETE FROM tabs WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn update_order(conn: &Connection, id: i64, sort_order: i32) -> Result<()> {
        conn.execute(
            "UPDATE tabs SET sort_order = ?1 WHERE id = ?2",
            params![sort_order, id],
        )?;
        Ok(())
    }
}
