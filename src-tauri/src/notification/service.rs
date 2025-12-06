use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

/// 新着メール通知を表示
pub fn notify_new_mail(
    app: &AppHandle,
    from_name: &str,
    subject: &str,
) -> Result<(), tauri_plugin_notification::Error> {
    app.notification()
        .builder()
        .title(from_name)
        .body(subject)
        .show()?;
    
    Ok(())
}

/// 複数の新着メール通知を表示
pub fn notify_new_mails(
    app: &AppHandle,
    count: usize,
) -> Result<(), tauri_plugin_notification::Error> {
    app.notification()
        .builder()
        .title("新着メール")
        .body(&format!("{}件の新着メールがあります", count))
        .show()?;
    
    Ok(())
}

