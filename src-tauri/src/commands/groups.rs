use crate::db::{self, models::{Group, GroupMember}};

/// グループ一覧を取得
#[tauri::command]
pub fn get_groups() -> Result<Vec<Group>, String> {
    db::with_db(|conn| Group::list(conn))
        .map_err(|e| e.to_string())
}

/// グループを取得
#[tauri::command]
pub fn get_group(id: i64) -> Result<Option<Group>, String> {
    db::with_db(|conn| Group::get(conn, id))
        .map_err(|e| e.to_string())
}

/// グループを作成
#[tauri::command]
pub fn create_group(name: String, avatar_color: String) -> Result<i64, String> {
    db::with_db(|conn| Group::create(conn, &name, &avatar_color))
        .map_err(|e| e.to_string())
}

/// グループを更新
#[tauri::command]
pub fn update_group(
    id: i64,
    name: String,
    avatar_color: String,
    is_pinned: bool,
    notify_enabled: bool,
    is_hidden: bool,
) -> Result<(), String> {
    db::with_db(|conn| Group::update(conn, id, &name, &avatar_color, is_pinned, notify_enabled, is_hidden))
        .map_err(|e| e.to_string())
}

/// グループを削除
#[tauri::command]
pub fn delete_group(id: i64) -> Result<(), String> {
    db::with_db(|conn| Group::delete(conn, id))
        .map_err(|e| e.to_string())
}

/// グループメンバー一覧を取得
#[tauri::command]
pub fn get_group_members(group_id: i64) -> Result<Vec<GroupMember>, String> {
    db::with_db(|conn| GroupMember::list_by_group(conn, group_id))
        .map_err(|e| e.to_string())
}

/// グループにメールアドレスを追加
#[tauri::command]
pub fn add_email_to_group(group_id: i64, email: String, display_name: Option<String>) -> Result<i64, String> {
    db::with_db(|conn| GroupMember::add(conn, group_id, &email, display_name.as_deref()))
        .map_err(|e| e.to_string())
}

/// グループからメールアドレスを削除
#[tauri::command]
pub fn remove_email_from_group(group_id: i64, email: String) -> Result<(), String> {
    db::with_db(|conn| GroupMember::remove(conn, group_id, &email))
        .map_err(|e| e.to_string())
}

/// グループを統合（source_idのメンバーとメッセージをtarget_idに移動し、source_idを削除）
#[tauri::command]
pub fn merge_groups(target_id: i64, source_id: i64) -> Result<(), String> {
    if target_id == source_id {
        return Err("Cannot merge a group with itself".to_string());
    }
    db::with_db(|conn| Group::merge(conn, target_id, source_id))
        .map_err(|e| e.to_string())
}

/// グループを分割（指定したメールアドレスを新しいグループに移動）
#[tauri::command]
pub fn split_group(source_id: i64, emails: Vec<String>, new_group_name: String) -> Result<i64, String> {
    if emails.is_empty() {
        return Err("No emails specified".to_string());
    }
    db::with_db(|conn| Group::split(conn, source_id, &emails, &new_group_name))
        .map_err(|e| e.to_string())
}
