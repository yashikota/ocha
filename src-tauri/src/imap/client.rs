use anyhow::{anyhow, Result};
use imap::Session;
use log::{info, error, debug};
use native_tls::TlsStream;
use std::net::TcpStream;

use crate::oauth::build_xoauth2_string;

const IMAP_SERVER: &str = "imap.gmail.com";
const IMAP_PORT: u16 = 993;

pub type ImapSession = Session<TlsStream<TcpStream>>;

/// Gmail IMAPに接続
pub fn connect(email: &str, access_token: &str) -> Result<ImapSession> {
    info!("Connecting to IMAP server {}:{}", IMAP_SERVER, IMAP_PORT);

    let tls = native_tls::TlsConnector::new()?;
    let client = imap::connect((IMAP_SERVER, IMAP_PORT), IMAP_SERVER, &tls)
        .map_err(|e| {
            error!("Failed to connect to IMAP server: {}", e);
            anyhow!("Failed to connect to IMAP server: {}", e)
        })?;

    info!("Connected to IMAP server, authenticating...");
    debug!("Email: {}", email);

    // XOAUTH2で認証
    let auth_string = build_xoauth2_string(email, access_token);
    let authenticator = XOAuth2Authenticator { auth_string };
    let session = client
        .authenticate("XOAUTH2", &authenticator)
        .map_err(|e| {
            error!("IMAP authentication failed: {:?}", e);
            anyhow!("IMAP authentication failed: {:?}", e)
        })?;

    info!("IMAP authentication successful");
    Ok(session)
}

struct XOAuth2Authenticator {
    auth_string: String,
}

impl imap::Authenticator for XOAuth2Authenticator {
    type Response = String;

    fn process(&self, _data: &[u8]) -> Self::Response {
        self.auth_string.clone()
    }
}

/// INBOXを選択
pub fn select_inbox(session: &mut ImapSession) -> Result<()> {
    session.select("INBOX")?;
    Ok(())
}

/// 指定UIDより大きいメールを取得
pub fn fetch_messages_since_uid(
    session: &mut ImapSession,
    since_uid: u32,
) -> Result<Vec<RawMessage>> {
    let query = if since_uid == 0 {
        // 最初の同期: 最新100件を取得
        "1:*".to_string()
    } else {
        // 差分同期: 指定UIDより大きいメールを取得
        format!("{}:*", since_uid + 1)
    };

    let messages = session.uid_fetch(&query, "(UID ENVELOPE BODY[] FLAGS)")?;

    let mut result = Vec::new();

    for msg in messages.iter() {
        if let Some(raw) = parse_fetch(msg) {
            // 既存のUIDはスキップ
            if raw.uid > since_uid {
                result.push(raw);
            }
        }
    }

    // 最新100件に制限（初回同期時）
    if since_uid == 0 && result.len() > 100 {
        let skip_count = result.len() - 100;
        result = result.into_iter().skip(skip_count).collect();
    }

    Ok(result)
}

/// フェッチ結果をパース
fn parse_fetch(fetch: &imap::types::Fetch) -> Option<RawMessage> {
    let uid = fetch.uid?;
    let envelope = fetch.envelope()?;
    let body = fetch.body()?;

    let from_email = envelope
        .from
        .as_ref()
        .and_then(|addrs| addrs.first())
        .and_then(|addr| {
            let mailbox = addr.mailbox.as_ref()?.to_vec();
            let host = addr.host.as_ref()?.to_vec();
            Some(format!(
                "{}@{}",
                String::from_utf8_lossy(&mailbox),
                String::from_utf8_lossy(&host)
            ))
        })?;

    let from_name = envelope
        .from
        .as_ref()
        .and_then(|addrs| addrs.first())
        .and_then(|addr| addr.name.as_ref())
        .map(|n| decode_mime_header(&String::from_utf8_lossy(n)));

    // Toアドレスを取得
    let to_email = envelope
        .to
        .as_ref()
        .and_then(|addrs| addrs.first())
        .and_then(|addr| {
            let mailbox = addr.mailbox.as_ref()?.to_vec();
            let host = addr.host.as_ref()?.to_vec();
            Some(format!(
                "{}@{}",
                String::from_utf8_lossy(&mailbox),
                String::from_utf8_lossy(&host)
            ))
        });

    let to_name = envelope
        .to
        .as_ref()
        .and_then(|addrs| addrs.first())
        .and_then(|addr| addr.name.as_ref())
        .map(|n| decode_mime_header(&String::from_utf8_lossy(n)));

    let subject = envelope
        .subject
        .as_ref()
        .map(|s| decode_mime_header(&String::from_utf8_lossy(s)));

    let message_id = envelope
        .message_id
        .as_ref()
        .map(|id| String::from_utf8_lossy(id).to_string());

    let date = envelope
        .date
        .as_ref()
        .map(|d| String::from_utf8_lossy(d).to_string());

    Some(RawMessage {
        uid,
        message_id,
        from_email,
        from_name,
        to_email,
        to_name,
        subject,
        date,
        body: body.to_vec(),
    })
}

/// MIMEエンコードされたヘッダーをデコード（mailparseを使用）
fn decode_mime_header(s: &str) -> String {
    // mailparseのRFC2047デコーダーを使用
    match mailparse::parse_header(format!("Subject: {}", s).as_bytes()) {
        Ok((header, _)) => {
            header.get_value()
        }
        Err(_) => {
            // フォールバック: 手動デコード
            decode_mime_header_manual(s)
        }
    }
}

/// 手動MIMEヘッダーデコード（フォールバック用）
fn decode_mime_header_manual(s: &str) -> String {
    use base64::Engine;

    // =?charset?encoding?text?= パターンを処理
    let mut result = String::new();
    let mut remaining = s;

    while !remaining.is_empty() {
        if let Some(start) = remaining.find("=?") {
            // エンコードされた部分の前のテキストを追加
            result.push_str(&remaining[..start]);
            remaining = &remaining[start..];

            // =?charset?encoding?text?= を探す
            if let Some(end) = remaining[2..].find("?=") {
                let encoded_part = &remaining[..end + 4];
                let parts: Vec<&str> = encoded_part[2..end + 2].split('?').collect();

                if parts.len() >= 3 {
                    let charset = parts[0];
                    let encoding = parts[1].to_uppercase();
                    let text = parts[2];

                    let decoded_bytes = if encoding == "B" {
                        base64::engine::general_purpose::STANDARD.decode(text).ok()
                    } else if encoding == "Q" {
                        decode_quoted_printable(text)
                    } else {
                        None
                    };

                    if let Some(bytes) = decoded_bytes {
                        let decoded_text = decode_charset(&bytes, charset);
                        result.push_str(&decoded_text);
                    } else {
                        result.push_str(encoded_part);
                    }
                } else {
                    result.push_str(encoded_part);
                }

                remaining = &remaining[end + 4..];
                // 連続したエンコード部分の間の空白をスキップ
                remaining = remaining.trim_start();
            } else {
                result.push_str(remaining);
                break;
            }
        } else {
            result.push_str(remaining);
            break;
        }
    }

    result
}

/// Quoted-Printableデコード
fn decode_quoted_printable(s: &str) -> Option<Vec<u8>> {
    let mut result = Vec::new();
    let s = s.replace("_", " ");
    let mut chars = s.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '=' {
            let hex: String = chars.by_ref().take(2).collect();
            if hex.len() == 2 {
                if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                    result.push(byte);
                }
            }
        } else {
            result.push(c as u8);
        }
    }

    Some(result)
}

/// 文字コードに応じてデコード
fn decode_charset(bytes: &[u8], charset: &str) -> String {
    use encoding_rs::*;

    let charset_upper = charset.to_uppercase();

    let encoding = if charset_upper.contains("UTF-8") || charset_upper.contains("UTF8") {
        UTF_8
    } else if charset_upper.contains("ISO-2022-JP") {
        ISO_2022_JP
    } else if charset_upper.contains("SHIFT_JIS") || charset_upper.contains("SHIFT-JIS") || charset_upper.contains("SJIS") {
        SHIFT_JIS
    } else if charset_upper.contains("EUC-JP") {
        EUC_JP
    } else if charset_upper.contains("ISO-8859-1") || charset_upper.contains("LATIN1") {
        WINDOWS_1252
    } else {
        // デフォルトはUTF-8
        UTF_8
    };

    let (decoded, _, _) = encoding.decode(bytes);
    decoded.to_string()
}

#[derive(Debug, Clone)]
pub struct RawMessage {
    pub uid: u32,
    pub message_id: Option<String>,
    pub from_email: String,
    pub from_name: Option<String>,
    pub to_email: Option<String>,
    pub to_name: Option<String>,
    pub subject: Option<String>,
    pub date: Option<String>,
    pub body: Vec<u8>,
}
