use anyhow::{anyhow, Result};
use once_cell::sync::OnceCell;
use parking_lot::Mutex;
use rand::Rng;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;

use crate::db::models::OAuthConfig;

const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const GMAIL_SCOPE: &str = "https://mail.google.com/";

// 認証状態を保持
static AUTH_STATE: OnceCell<Mutex<Option<AuthState>>> = OnceCell::new();

struct AuthState {
    code_verifier: String,
    state: String,
}

fn get_auth_state() -> &'static Mutex<Option<AuthState>> {
    AUTH_STATE.get_or_init(|| Mutex::new(None))
}

/// ランダムな文字列を生成
fn generate_random_string(len: usize) -> String {
    let chars: Vec<char> = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
        .chars()
        .collect();
    let mut rng = rand::thread_rng();
    (0..len).map(|_| chars[rng.gen_range(0..chars.len())]).collect()
}

/// PKCE code challengeを生成
fn generate_code_challenge(verifier: &str) -> String {
    use base64::Engine;
    use sha2::Digest;
    
    let mut hasher = sha2::Sha256::new();
    hasher.update(verifier.as_bytes());
    let hash = hasher.finalize();
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(hash)
}

/// OAuth認証URLを生成
pub fn start_oauth_flow(config: &OAuthConfig) -> Result<String> {
    let code_verifier = generate_random_string(64);
    let code_challenge = generate_code_challenge(&code_verifier);
    let state = generate_random_string(32);
    
    // 認証状態を保存
    *get_auth_state().lock() = Some(AuthState {
        code_verifier,
        state: state.clone(),
    });
    
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&state={}&code_challenge={}&code_challenge_method=S256",
        AUTH_URL,
        urlencoding::encode(&config.client_id),
        urlencoding::encode(&config.redirect_uri),
        urlencoding::encode(GMAIL_SCOPE),
        urlencoding::encode(&state),
        urlencoding::encode(&code_challenge),
    );
    
    Ok(auth_url)
}

/// コールバックを受け取り、トークンを取得
pub async fn handle_oauth_callback(config: &OAuthConfig) -> Result<TokenResult> {
    // リダイレクトURIからポートを抽出
    let port = extract_port(&config.redirect_uri)?;
    let listener = TcpListener::bind(format!("127.0.0.1:{}", port))?;
    
    // 接続を待機
    let (mut stream, _) = listener.accept()?;
    
    let mut reader = BufReader::new(&stream);
    let mut request_line = String::new();
    reader.read_line(&mut request_line)?;
    
    // リクエストからコードとstateを抽出
    let (code, state) = parse_callback_request(&request_line)?;
    
    // CSRF検証
    let auth_state = get_auth_state().lock().take()
        .ok_or_else(|| anyhow!("No pending OAuth flow"))?;
    
    if state != auth_state.state {
        return Err(anyhow!("CSRF token mismatch"));
    }
    
    // 成功レスポンスを返す
    let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n\
        <html><body><h1>認証成功!</h1><p>このウィンドウを閉じてアプリに戻ってください。</p></body></html>";
    stream.write_all(response.as_bytes())?;
    drop(stream);
    
    // トークンを取得
    let client = reqwest::Client::new();
    let response = client
        .post(TOKEN_URL)
        .form(&[
            ("client_id", config.client_id.as_str()),
            ("client_secret", config.client_secret.as_str()),
            ("code", &code),
            ("code_verifier", &auth_state.code_verifier),
            ("grant_type", "authorization_code"),
            ("redirect_uri", &config.redirect_uri),
        ])
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await?;
        return Err(anyhow!("Token exchange failed: {}", error_text));
    }
    
    let token_response: TokenResponse = response.json().await?;
    
    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(token_response.expires_in as i64);
    
    Ok(TokenResult {
        access_token: token_response.access_token,
        refresh_token: token_response.refresh_token
            .ok_or_else(|| anyhow!("No refresh token received"))?,
        expires_at: expires_at.to_rfc3339(),
    })
}

/// リフレッシュトークンを使ってアクセストークンを更新
pub async fn refresh_access_token(config: &OAuthConfig, refresh_token: &str) -> Result<TokenResult> {
    let client = reqwest::Client::new();
    let response = client
        .post(TOKEN_URL)
        .form(&[
            ("client_id", config.client_id.as_str()),
            ("client_secret", config.client_secret.as_str()),
            ("refresh_token", refresh_token),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await?;
    
    if !response.status().is_success() {
        let error_text = response.text().await?;
        return Err(anyhow!("Token refresh failed: {}", error_text));
    }
    
    let token_response: TokenResponse = response.json().await?;
    
    let expires_at = chrono::Utc::now() + chrono::Duration::seconds(token_response.expires_in as i64);
    
    Ok(TokenResult {
        access_token: token_response.access_token,
        refresh_token: token_response.refresh_token.unwrap_or_else(|| refresh_token.to_string()),
        expires_at: expires_at.to_rfc3339(),
    })
}

#[derive(Debug, serde::Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
}

#[derive(Debug, Clone)]
pub struct TokenResult {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: String,
}

fn extract_port(redirect_uri: &str) -> Result<u16> {
    let url = url::Url::parse(redirect_uri)?;
    url.port().ok_or_else(|| anyhow!("No port in redirect URI"))
}

fn parse_callback_request(request_line: &str) -> Result<(String, String)> {
    // GET /callback?code=xxx&state=yyy HTTP/1.1
    let path = request_line
        .split_whitespace()
        .nth(1)
        .ok_or_else(|| anyhow!("Invalid request"))?;
    
    let url = url::Url::parse(&format!("http://localhost{}", path))?;
    
    let code = url
        .query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .ok_or_else(|| anyhow!("No code in callback"))?;
    
    let state = url
        .query_pairs()
        .find(|(k, _)| k == "state")
        .map(|(_, v)| v.to_string())
        .ok_or_else(|| anyhow!("No state in callback"))?;
    
    Ok((code, state))
}

/// XOAUTH2認証文字列を生成
pub fn build_xoauth2_string(email: &str, access_token: &str) -> String {
    use base64::Engine;
    let auth_string = format!("user={}\x01auth=Bearer {}\x01\x01", email, access_token);
    base64::engine::general_purpose::STANDARD.encode(auth_string.as_bytes())
}

/// ユーザー情報を取得
pub async fn get_user_info(access_token: &str) -> Result<UserInfo> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://www.googleapis.com/oauth2/v2/userinfo")
        .bearer_auth(access_token)
        .send()
        .await?
        .json::<UserInfo>()
        .await?;
    
    Ok(response)
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct UserInfo {
    pub email: String,
    pub name: Option<String>,
    pub picture: Option<String>,
}
