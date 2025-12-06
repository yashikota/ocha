use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

use crate::db::{self, models::{Account, OAuthConfig}};
use crate::oauth;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub has_oauth_config: bool,
    pub is_authenticated: bool,
    pub account: Option<Account>,
}

/// OAuth設定を保存
#[tauri::command]
pub fn save_oauth_config(client_id: String, client_secret: String) -> Result<(), String> {
    let config = OAuthConfig {
        client_id,
        client_secret,
        redirect_uri: "http://localhost:8234/callback".to_string(),
    };
    
    db::with_db(|conn| OAuthConfig::save(conn, &config))
        .map_err(|e| e.to_string())
}

/// OAuth設定を取得
#[tauri::command]
pub fn get_oauth_config() -> Result<Option<OAuthConfig>, String> {
    db::with_db(|conn| OAuthConfig::get(conn))
        .map_err(|e| e.to_string())
}

/// 認証状態を取得
#[tauri::command]
pub fn check_auth_status() -> Result<AuthStatus, String> {
    let has_oauth_config = db::with_db(|conn| {
        OAuthConfig::get(conn).map(|c| c.is_some())
    }).map_err(|e| e.to_string())?;
    
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?;
    
    Ok(AuthStatus {
        has_oauth_config,
        is_authenticated: account.is_some(),
        account,
    })
}

/// OAuth認証を開始（認証URLを返す）
#[tauri::command]
pub fn start_oauth() -> Result<String, String> {
    let config = db::with_db(|conn| OAuthConfig::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("OAuth config not found")?;
    
    oauth::start_oauth_flow(&config)
        .map_err(|e| e.to_string())
}

/// OAuth認証を実行（ブラウザを開いてコールバックを待つ）
#[tauri::command]
pub async fn perform_oauth(app: AppHandle) -> Result<Account, String> {
    let config = db::with_db(|conn| OAuthConfig::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("OAuth config not found")?;
    
    // 認証URLを生成
    let auth_url = oauth::start_oauth_flow(&config)
        .map_err(|e| e.to_string())?;
    
    // ブラウザで認証URLを開く
    app.opener()
        .open_url(&auth_url, None::<&str>)
        .map_err(|e| format!("Failed to open browser: {}", e))?;
    
    // コールバックを待機してトークンを取得
    let token_result = oauth::handle_oauth_callback(&config)
        .await
        .map_err(|e| e.to_string())?;
    
    // ユーザー情報を取得
    let user_info = oauth::get_user_info(&token_result.access_token)
        .await
        .map_err(|e| e.to_string())?;
    
    // アカウントを保存
    db::with_db(|conn| {
        Account::save(
            conn,
            &user_info.email,
            &token_result.access_token,
            &token_result.refresh_token,
            &token_result.expires_at,
        )
    }).map_err(|e| e.to_string())?;
    
    // アカウントを取得して返す
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("Account not found after save")?;
    
    Ok(account)
}

/// OAuthコールバックを処理（後方互換性のため残す）
#[tauri::command]
pub async fn handle_oauth_callback() -> Result<Account, String> {
    let config = db::with_db(|conn| OAuthConfig::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("OAuth config not found")?;
    
    // トークンを取得
    let token_result = oauth::handle_oauth_callback(&config)
        .await
        .map_err(|e| e.to_string())?;
    
    // ユーザー情報を取得
    let user_info = oauth::get_user_info(&token_result.access_token)
        .await
        .map_err(|e| e.to_string())?;
    
    // アカウントを保存
    db::with_db(|conn| {
        Account::save(
            conn,
            &user_info.email,
            &token_result.access_token,
            &token_result.refresh_token,
            &token_result.expires_at,
        )
    }).map_err(|e| e.to_string())?;
    
    // アカウントを取得して返す
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("Account not found after save")?;
    
    Ok(account)
}

/// ログアウト
#[tauri::command]
pub fn logout() -> Result<(), String> {
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?;
    
    if let Some(account) = account {
        db::with_db(|conn| Account::delete(conn, account.id))
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

/// アクセストークンを更新
#[tauri::command]
pub async fn refresh_token() -> Result<Account, String> {
    let config = db::with_db(|conn| OAuthConfig::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("OAuth config not found")?;
    
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("Not authenticated")?;
    
    let refresh_token = account.refresh_token
        .as_ref()
        .ok_or("No refresh token")?;
    
    // トークンを更新
    let token_result = oauth::refresh_access_token(&config, refresh_token)
        .await
        .map_err(|e| e.to_string())?;
    
    // アカウントを更新
    db::with_db(|conn| {
        Account::save(
            conn,
            &account.email,
            &token_result.access_token,
            &token_result.refresh_token,
            &token_result.expires_at,
        )
    }).map_err(|e| e.to_string())?;
    
    // アカウントを取得して返す
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("Account not found after update")?;
    
    Ok(account)
}
