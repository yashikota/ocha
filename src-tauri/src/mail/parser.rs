use anyhow::Result;
use mailparse::{parse_mail, MailHeaderMap, ParsedMail};

use crate::imap::RawMessage;

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

#[derive(Debug, Clone)]
pub struct ParsedAttachment {
    pub filename: String,
    pub mime_type: String,
    pub size: usize,
}

/// 生メールをパース（mailparseで全部やる）
pub fn parse_email(raw: &RawMessage) -> Result<ParsedEmail> {
    let parsed = parse_mail(&raw.body)?;

    // ヘッダーから情報を取得（mailparseが自動デコード）
    let from = parsed.headers.get_first_value("From").unwrap_or_default();
    let (from_name, from_email) = parse_address(&from);

    let to = parsed.headers.get_first_value("To").unwrap_or_default();
    let (to_name, to_email) = parse_address(&to);

    let subject = parsed.headers.get_first_value("Subject");
    let message_id = parsed.headers.get_first_value("Message-ID")
        .map(|s| s.trim_matches(|c| c == '<' || c == '>').to_string());
    let date = parsed.headers.get_first_value("Date");

    let (body_text, body_html) = extract_body(&parsed);
    let attachments = extract_attachments(&parsed);

    let received_at = date
        .as_ref()
        .and_then(|d| parse_date(d))
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    Ok(ParsedEmail {
        uid: raw.uid,
        message_id,
        from_email,
        from_name,
        to_email: if to_email.is_empty() { None } else { Some(to_email) },
        to_name,
        subject,
        body_text,
        body_html,
        received_at,
        attachments,
    })
}

/// アドレスをパース: "Name <email>" または "email"
fn parse_address(addr: &str) -> (Option<String>, String) {
    let addr = addr.trim();
    
    if let Some(start) = addr.find('<') {
        if let Some(end) = addr.find('>') {
            let email = addr[start + 1..end].trim().to_string();
            let name = addr[..start].trim().trim_matches('"').to_string();
            let name = if name.is_empty() { None } else { Some(name) };
            return (name, email);
        }
    }
    
    (None, addr.to_string())
}

/// メール本文を抽出
fn extract_body(mail: &ParsedMail) -> (Option<String>, Option<String>) {
    let mut text_body = None;
    let mut html_body = None;

    if mail.subparts.is_empty() {
        let content_type = mail.ctype.mimetype.as_str();
        if let Ok(body) = mail.get_body() {
            if content_type.starts_with("text/plain") {
                text_body = Some(body);
            } else if content_type.starts_with("text/html") {
                html_body = Some(body);
            }
        }
    } else {
        extract_body_recursive(mail, &mut text_body, &mut html_body);
    }

    (text_body, html_body)
}

fn extract_body_recursive(mail: &ParsedMail, text_body: &mut Option<String>, html_body: &mut Option<String>) {
    let content_type = mail.ctype.mimetype.as_str();

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

    let is_attachment = mail
        .headers
        .get_first_value("Content-Disposition")
        .map(|d| d.to_lowercase().starts_with("attachment"))
        .unwrap_or(false);

    let is_inline_attachment = !content_type.starts_with("text/")
        && !content_type.starts_with("multipart/")
        && mail.ctype.params.contains_key("name");

    if is_attachment || is_inline_attachment {
        let filename = mail.ctype.params.get("name").cloned()
            .or_else(|| {
                mail.headers.get_first_value("Content-Disposition")
                    .and_then(|d| extract_filename_param(&d))
            })
            .unwrap_or_else(|| "unknown".to_string());

        if let Ok(data) = mail.get_body_raw() {
            attachments.push(ParsedAttachment {
                filename,
                mime_type: content_type.to_string(),
                size: data.len(),
            });
        }
    }

    for subpart in &mail.subparts {
        extract_attachments_recursive(subpart, attachments);
    }
}

fn extract_filename_param(disposition: &str) -> Option<String> {
    let lower = disposition.to_lowercase();
    if let Some(pos) = lower.find("filename=") {
        let rest = &disposition[pos + 9..];
        let value = if rest.starts_with('"') {
            rest[1..].split('"').next()
        } else {
            rest.split(';').next().map(|s| s.trim())
        };
        return value.map(|s| s.to_string());
    }
    None
}

/// 日付をパース
fn parse_date(date_str: &str) -> Option<String> {
    if let Ok(dt) = chrono::DateTime::parse_from_rfc2822(date_str) {
        return Some(dt.with_timezone(&chrono::Utc).to_rfc3339());
    }
    None
}
