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

/// フォルダ一覧を取得
pub fn list_folders(session: &mut ImapSession) -> Result<Vec<String>> {
    let folders = session.list(Some(""), Some("*"))?;
    let folder_names: Vec<String> = folders
        .iter()
        .map(|f| f.name().to_string())
        .collect();
    Ok(folder_names)
}

/// 送信済みフォルダを検索
pub fn find_sent_folder(session: &mut ImapSession) -> Option<String> {
    if let Ok(folders) = list_folders(session) {
        // Gmailの送信済みフォルダを探す（ロケール対応）
        let sent_patterns = [
            "Sent",          // 部分一致
            "送信済み",        // 日本語
            "已发送",          // 中国語
            "Enviados",      // スペイン語
            "Envoyés",       // フランス語
            "Gesendet",      // ドイツ語
        ];

        for folder in &folders {
            // 完全一致または部分一致で検索
            let folder_lower = folder.to_lowercase();
            for pattern in &sent_patterns {
                if folder_lower.contains(&pattern.to_lowercase()) {
                    info!("Found sent folder: {}", folder);
                    return Some(folder.clone());
                }
            }
        }

        // フォルダ一覧をログに出力
        debug!("Available folders: {:?}", folders);
    }
    None
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

/// MIMEエンコードされたヘッダーをデコード
fn decode_mime_header(s: &str) -> String {
    // エンコードされた部分がなければそのまま返す
    if !s.contains("=?") {
        return s.to_string();
    }

    // 手動デコードを使用（より信頼性が高い）
    decode_mime_header_manual(s)
}

/// 手動MIMEヘッダーデコード（RFC 2047）
fn decode_mime_header_manual(s: &str) -> String {
    // 正規表現パターン: =?charset?encoding?text?=
    let mut result = String::new();
    let mut i = 0;
    let bytes = s.as_bytes();

    while i < bytes.len() {
        // =? を探す
        if i + 1 < bytes.len() && bytes[i] == b'=' && bytes[i + 1] == b'?' {
            // エンコードされた部分を解析
            if let Some((decoded, consumed)) = parse_encoded_word(&s[i..]) {
                result.push_str(&decoded);
                i += consumed;
                // 連続エンコード部分間の空白をスキップ
                while i < bytes.len() && (bytes[i] == b' ' || bytes[i] == b'\t') {
                    if i + 1 < bytes.len() && bytes[i + 1] == b'=' {
                        i += 1; // 空白をスキップ
                        break;
                    }
                    i += 1;
                }
                continue;
            }
        }

        // 通常の文字を追加
        if let Some(c) = s[i..].chars().next() {
            result.push(c);
            i += c.len_utf8();
        } else {
            i += 1;
        }
    }

    result
}

/// =?charset?encoding?text?= 形式をパース
fn parse_encoded_word(s: &str) -> Option<(String, usize)> {
    use base64::Engine;

    if !s.starts_with("=?") {
        return None;
    }

    // =?charset?encoding?text?= の各部分を抽出
    let rest = &s[2..];

    // charset を探す
    let charset_end = rest.find('?')?;
    let charset = &rest[..charset_end];
    let rest = &rest[charset_end + 1..];

    // encoding を探す
    let encoding_end = rest.find('?')?;
    let encoding = &rest[..encoding_end];
    let rest = &rest[encoding_end + 1..];

    // text と ?= を探す
    let text_end = rest.find("?=")?;
    let text = &rest[..text_end];

    // 全体の長さ: =? + charset + ? + encoding + ? + text + ?=
    let total_len = 2 + charset_end + 1 + encoding_end + 1 + text_end + 2;

    // デコード
    let decoded_bytes = match encoding.to_uppercase().as_str() {
        "B" => base64::engine::general_purpose::STANDARD.decode(text).ok()?,
        "Q" => decode_quoted_printable(text)?,
        _ => return None,
    };

    let decoded_text = decode_charset(&decoded_bytes, charset);

    Some((decoded_text, total_len))
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
