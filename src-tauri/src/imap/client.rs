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

/// フォルダを属性で検索
pub fn find_folder_by_attr(session: &mut ImapSession, attr_name: &str) -> Option<String> {
    if let Ok(folders) = session.list(Some(""), Some("*")) {
        for folder in folders.iter() {
            let attrs: Vec<String> = folder.attributes().iter().map(|a| format!("{:?}", a)).collect();
            debug!("Folder: {} - Attributes: {:?}", folder.name(), attrs);

            for attr in &attrs {
                if attr.contains(attr_name) {
                    info!("Found {} folder: {}", attr_name, folder.name());
                    return Some(folder.name().to_string());
                }
            }
        }
    }
    None
}


/// 指定UIDより大きいメールを取得（初回は全件）
pub fn fetch_messages_since_uid(
    session: &mut ImapSession,
    since_uid: u32,
) -> Result<Vec<RawMessage>> {
    let query = if since_uid == 0 {
        "1:*".to_string()
    } else {
        format!("{}:*", since_uid + 1)
    };

    let messages = session.uid_fetch(&query, "(UID BODY[])")?;
    let mut result = Vec::new();

    for msg in messages.iter() {
        if let Some(uid) = msg.uid {
            if uid > since_uid {
                if let Some(body) = msg.body() {
                    result.push(RawMessage {
                        uid,
                        body: body.to_vec(),
                    });
                }
            }
        }
    }

    Ok(result)
}

#[derive(Debug, Clone)]
pub struct RawMessage {
    pub uid: u32,
    pub body: Vec<u8>,
}

/// 特定UIDのメッセージを取得
pub fn fetch_message_by_uid(
    session: &mut ImapSession,
    uid: u32,
) -> Result<Option<RawMessage>> {
    let messages = session.uid_fetch(uid.to_string(), "(UID BODY[])")?;

    for msg in messages.iter() {
        if let Some(msg_uid) = msg.uid {
            if msg_uid == uid {
                if let Some(body) = msg.body() {
                    return Ok(Some(RawMessage {
                        uid: msg_uid,
                        body: body.to_vec(),
                    }));
                }
            }
        }
    }

    Ok(None)
}
