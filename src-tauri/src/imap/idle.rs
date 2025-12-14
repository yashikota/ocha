use anyhow::Result;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use std::thread;

use super::client::{connect, fetch_messages_since_uid, select_inbox, RawMessage};

static IDLE_RUNNING: AtomicBool = AtomicBool::new(false);
static IDLE_STOP: AtomicBool = AtomicBool::new(false);

/// IMAP監視を開始（ポーリング方式）
pub fn start_idle_watch<F, T>(
    email: String,
    token_provider: T,
    last_uid: u32,
    on_new_mail: F,
) -> Result<()>
where
    F: Fn(Vec<RawMessage>) + Send + Sync + 'static,
    T: Fn() -> Result<String> + Send + Sync + 'static,
{
    if IDLE_RUNNING.swap(true, Ordering::SeqCst) {
        return Ok(()); // 既に実行中
    }

    IDLE_STOP.store(false, Ordering::SeqCst);

    let on_new_mail = Arc::new(on_new_mail);
    let token_provider = Arc::new(token_provider);
    let mut current_uid = last_uid;

    thread::spawn(move || {
        loop {
            // 停止シグナルをチェック
            if IDLE_STOP.load(Ordering::SeqCst) {
                break;
            }

            // トークンを取得
            let access_token = match token_provider() {
                Ok(token) => token,
                Err(e) => {
                    eprintln!("Failed to get access token: {:?}", e);
                    thread::sleep(Duration::from_secs(60));
                    continue;
                }
            };

            // IMAPに接続
            let session_result = connect(&email, &access_token);
            let mut session = match session_result {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("IMAP connection failed: {:?}", e);
                    thread::sleep(Duration::from_secs(30));
                    continue;
                }
            };

            // INBOXを選択
            if let Err(e) = select_inbox(&mut session) {
                eprintln!("Failed to select INBOX: {:?}", e);
                thread::sleep(Duration::from_secs(30));
                continue;
            }

            // ポーリングループ
            loop {
                // 停止シグナルをチェック
                if IDLE_STOP.load(Ordering::SeqCst) {
                    break;
                }

                // 新着メールをチェック
                match fetch_messages_since_uid(&mut session, current_uid) {
                    Ok(messages) => {
                        if !messages.is_empty() {
                            // 最新UIDを更新
                            if let Some(max_uid) = messages.iter().map(|m| m.uid).max() {
                                current_uid = max_uid;
                            }
                            // コールバックを呼び出し
                            on_new_mail(messages);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to fetch messages: {:?}", e);
                        // 認証エラーの可能性もあるのでループを抜けて再接続（トークン再取得）
                        break;
                    }
                }

                // 30秒待機
                for _ in 0..30 {
                    if IDLE_STOP.load(Ordering::SeqCst) {
                        break;
                    }
                    thread::sleep(Duration::from_secs(1));
                }
            }
        }

        IDLE_RUNNING.store(false, Ordering::SeqCst);
    });

    Ok(())
}

/// IMAP監視を停止
pub fn stop_idle_watch() {
    IDLE_STOP.store(true, Ordering::SeqCst);
}
