pub mod models;
mod schema;

use anyhow::Result;
use log::info;
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use rusqlite::Connection;
use std::path::PathBuf;

static DB: OnceCell<Mutex<Connection>> = OnceCell::new();

/// データベースファイル名を取得（環境で分離）
fn get_db_filename() -> &'static str {
    #[cfg(debug_assertions)]
    {
        "ocha_dev.db"
    }

    #[cfg(not(debug_assertions))]
    {
        "ocha.db"
    }
}

/// データベースを初期化する
pub fn init(app_data_dir: PathBuf) -> Result<()> {
    std::fs::create_dir_all(&app_data_dir)?;

    let db_filename = get_db_filename();
    let db_path = app_data_dir.join(&db_filename);

    info!("Using database: {:?}", db_path);

    let conn = Connection::open(&db_path)?;
    schema::create_tables(&conn)?;

    DB.set(Mutex::new(conn))
        .map_err(|_| anyhow::anyhow!("Database already initialized"))?;

    Ok(())
}

/// データベース接続を取得する
pub fn get_connection() -> &'static Mutex<Connection> {
    DB.get().expect("Database not initialized")
}

/// データベースを使って処理を実行する
pub fn with_db<F, T>(f: F) -> Result<T>
where
    F: FnOnce(&Connection) -> Result<T>,
{
    let conn = get_connection().lock();
    f(&conn)
}
