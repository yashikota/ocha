use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

/// 新着メール通知を表示
pub fn notify_new_mail(
    app: &AppHandle,
    from_name: &str,
    subject: &str,
    group_id: i64,
) -> Result<(), tauri_plugin_notification::Error> {
    use std::collections::HashMap;
    let mut data = HashMap::new();
    data.insert("groupId".to_string(), group_id.to_string());

    app.notification()
        .builder()
        .title(from_name)
        .body(subject)
        .action_type_id(format!("group_{}", group_id))
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
