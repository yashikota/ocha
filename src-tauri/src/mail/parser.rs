use anyhow::Result;
use base64::Engine;
use mailparse::{parse_mail, MailHeaderMap, ParsedMail};

use crate::imap::RawMessage;

/// パース済みメール
#[derive(Debug, Clone)]
pub struct ParsedEmail {
    pub uid: u32,
    pub message_id: Option<String>,
    pub from_email: String,
    pub from_name: Option<String>,
    pub to_email: Option<String>,
    pub to_name: Option<String>,
    pub subject: Option<String>,
    pub body_text: Option<String>,
    pub body_html: Option<String>,
    pub received_at: String,
    pub attachments: Vec<ParsedAttachment>,
}

/// パース済み添付ファイル
#[derive(Debug, Clone)]
pub struct ParsedAttachment {
    pub filename: String,
    pub mime_type: String,
    pub size: usize,
    pub data: Vec<u8>,
}

/// 生メールをパース
pub fn parse_email(raw: &RawMessage) -> Result<ParsedEmail> {
    let parsed = parse_mail(&raw.body)?;

    let (body_text, body_html) = extract_body(&parsed);
    let attachments = extract_attachments(&parsed);

    // 日付をパース
    let received_at = raw
        .date
        .as_ref()
        .and_then(|d| parse_date(d))
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    Ok(ParsedEmail {
        uid: raw.uid,
        message_id: raw.message_id.clone(),
        from_email: raw.from_email.clone(),
        from_name: raw.from_name.clone(),
        to_email: raw.to_email.clone(),
        to_name: raw.to_name.clone(),
        subject: raw.subject.clone(),
        body_text,
        body_html,
        received_at,
        attachments,
    })
}

/// メール本文を抽出
fn extract_body(mail: &ParsedMail) -> (Option<String>, Option<String>) {
    let mut text_body = None;
    let mut html_body = None;

    if mail.subparts.is_empty() {
        // シングルパートメール
        let content_type = mail.ctype.mimetype.as_str();
        if let Ok(body) = mail.get_body() {
            if content_type.starts_with("text/plain") {
                text_body = Some(body);
            } else if content_type.starts_with("text/html") {
                html_body = Some(body);
            }
        }
    } else {
        // マルチパートメール
        extract_body_recursive(mail, &mut text_body, &mut html_body);
    }

    (text_body, html_body)
}

fn extract_body_recursive(
    mail: &ParsedMail,
    text_body: &mut Option<String>,
    html_body: &mut Option<String>,
) {
    let content_type = mail.ctype.mimetype.as_str();

    // 添付ファイルはスキップ
    if let Some(disposition) = mail.headers.get_first_value("Content-Disposition") {
        if disposition.to_lowercase().starts_with("attachment") {
            return;
        }
    }

    if content_type.starts_with("text/plain") && text_body.is_none() {
        if let Ok(body) = mail.get_body() {
            *text_body = Some(body);
        }
    } else if content_type.starts_with("text/html") && html_body.is_none() {
        if let Ok(body) = mail.get_body() {
            *html_body = Some(body);
        }
    }

    // 再帰的にサブパートを処理
    for subpart in &mail.subparts {
        extract_body_recursive(subpart, text_body, html_body);
    }
}

/// 添付ファイルを抽出
fn extract_attachments(mail: &ParsedMail) -> Vec<ParsedAttachment> {
    let mut attachments = Vec::new();
    extract_attachments_recursive(mail, &mut attachments);
    attachments
}

fn extract_attachments_recursive(mail: &ParsedMail, attachments: &mut Vec<ParsedAttachment>) {
    let content_type = mail.ctype.mimetype.as_str();

    // Content-Dispositionをチェック
    let is_attachment = mail
        .headers
        .get_first_value("Content-Disposition")
        .map(|d| d.to_lowercase().starts_with("attachment"))
        .unwrap_or(false);

    // インライン以外で、テキストでない場合も添付ファイルとして扱う
    let is_inline_attachment = !content_type.starts_with("text/")
        && !content_type.starts_with("multipart/")
        && mail.ctype.params.contains_key("name");

    if is_attachment || is_inline_attachment {
        let filename = get_attachment_filename(mail);
        if let Some(filename) = filename {
            if let Ok(data) = mail.get_body_raw() {
                attachments.push(ParsedAttachment {
                    filename,
                    mime_type: content_type.to_string(),
                    size: data.len(),
                    data,
                });
            }
        }
    }

    // 再帰的にサブパートを処理
    for subpart in &mail.subparts {
        extract_attachments_recursive(subpart, attachments);
    }
}

/// 添付ファイル名を取得
fn get_attachment_filename(mail: &ParsedMail) -> Option<String> {
    // Content-Dispositionからfilenameを取得
    if let Some(disposition) = mail.headers.get_first_value("Content-Disposition") {
        if let Some(filename) = extract_param(&disposition, "filename") {
            return Some(decode_filename(&filename));
        }
    }

    // Content-Typeからnameを取得
    if let Some(name) = mail.ctype.params.get("name") {
        return Some(decode_filename(name));
    }

    None
}

/// パラメータを抽出
fn extract_param(header: &str, param_name: &str) -> Option<String> {
    let pattern = format!("{}=", param_name);
    if let Some(pos) = header.to_lowercase().find(&pattern) {
        let start = pos + pattern.len();
        let rest = &header[start..];

        if rest.starts_with('"') {
            // クォートされている場合
            if let Some(end) = rest[1..].find('"') {
                return Some(rest[1..end + 1].to_string());
            }
        } else {
            // クォートされていない場合
            let end = rest.find(';').unwrap_or(rest.len());
            return Some(rest[..end].trim().to_string());
        }
    }
    None
}

/// ファイル名をデコード
fn decode_filename(filename: &str) -> String {
    // RFC 2047エンコーディングをデコード
    if filename.starts_with("=?") {
        // 簡易的なMIMEデコード
        if let Some(decoded) = decode_mime_word(filename) {
            return decoded;
        }
    }

    // RFC 2231エンコーディングをデコード
    if filename.contains("''") {
        if let Some(pos) = filename.find("''") {
            let encoded = &filename[pos + 2..];
            return percent_decode(encoded);
        }
    }

    filename.to_string()
}

fn decode_mime_word(s: &str) -> Option<String> {
    // =?charset?encoding?text?= 形式
    let parts: Vec<&str> = s.split('?').collect();
    if parts.len() >= 4 {
        let encoding = parts[2].to_uppercase();
        let text = parts[3].trim_end_matches("?=");

        if encoding == "B" {
            // Base64
            if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(text) {
                if let Ok(s) = String::from_utf8(decoded) {
                    return Some(s);
                }
            }
        } else if encoding == "Q" {
            // Quoted-Printable
            return Some(decode_quoted_printable(text));
        }
    }
    None
}

fn decode_quoted_printable(s: &str) -> String {
    let mut result = String::new();
    let mut chars = s.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '=' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte as char);
            }
        } else if c == '_' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }

    result
}

fn percent_decode(s: &str) -> String {
    let mut result = Vec::new();
    let mut chars = s.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte);
            }
        } else {
            result.push(c as u8);
        }
    }

    String::from_utf8_lossy(&result).to_string()
}

/// 日付文字列をパース
fn parse_date(date_str: &str) -> Option<String> {
    // RFC 2822形式の日付をパース
    if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(date_str) {
        return Some(dt.with_timezone(&chrono::Utc).to_rfc3339());
    }

    // その他の一般的な形式を試す
    let formats = [
        "%a, %d %b %Y %H:%M:%S %z",
        "%d %b %Y %H:%M:%S %z",
        "%a, %d %b %Y %H:%M:%S",
        "%d %b %Y %H:%M:%S",
    ];

    for fmt in &formats {
        if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(date_str.trim(), fmt) {
            return Some(dt.and_utc().to_rfc3339());
        }
    }

    None
}
