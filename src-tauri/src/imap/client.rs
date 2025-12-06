use anyhow::{anyhow, Result};
use imap::Session;
use native_tls::TlsStream;
use std::net::TcpStream;

use crate::oauth::build_xoauth2_string;

const IMAP_SERVER: &str = "imap.gmail.com";
const IMAP_PORT: u16 = 993;

pub type ImapSession = Session<TlsStream<TcpStream>>;

/// Gmail IMAPに接続
pub fn connect(email: &str, access_token: &str) -> Result<ImapSession> {
    let tls = native_tls::TlsConnector::new()?;
    let client = imap::connect((IMAP_SERVER, IMAP_PORT), IMAP_SERVER, &tls)?;
    
    // XOAUTH2で認証
    let auth_string = build_xoauth2_string(email, access_token);
    let authenticator = XOAuth2Authenticator { auth_string };
    let session = client
        .authenticate("XOAUTH2", &authenticator)
        .map_err(|e| anyhow!("IMAP authentication failed: {:?}", e))?;
    
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
        subject,
        date,
        body: body.to_vec(),
    })
}

/// MIMEエンコードされたヘッダーをデコード
fn decode_mime_header(s: &str) -> String {
    use base64::Engine;
    
    // 簡易的なMIMEデコード（=?UTF-8?B?...?= 形式）
    if s.starts_with("=?") && s.contains("?B?") {
        if let Some(start) = s.find("?B?") {
            if let Some(end) = s[start + 3..].find("?=") {
                let encoded = &s[start + 3..start + 3 + end];
                if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(encoded) {
                    if let Ok(text) = String::from_utf8(decoded) {
                        return text;
                    }
                }
            }
        }
    }
    
    // =?UTF-8?Q?...?= 形式（Quoted-Printable）
    if s.starts_with("=?") && s.contains("?Q?") {
        if let Some(start) = s.find("?Q?") {
            if let Some(end) = s[start + 3..].find("?=") {
                let encoded = &s[start + 3..start + 3 + end];
                let decoded = encoded
                    .replace("_", " ")
                    .replace("=20", " ");
                // 簡易的な=XXデコード
                let mut result = String::new();
                let mut chars = decoded.chars().peekable();
                while let Some(c) = chars.next() {
                    if c == '=' {
                        let hex: String = chars.by_ref().take(2).collect();
                        if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                            result.push(byte as char);
                        }
                    } else {
                        result.push(c);
                    }
                }
                return result;
            }
        }
    }
    
    s.to_string()
}

#[derive(Debug, Clone)]
pub struct RawMessage {
    pub uid: u32,
    pub message_id: Option<String>,
    pub from_email: String,
    pub from_name: Option<String>,
    pub subject: Option<String>,
    pub date: Option<String>,
    pub body: Vec<u8>,
}
