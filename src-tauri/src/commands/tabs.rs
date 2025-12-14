use crate::db;
use crate::db::tabs::Tab;
use log::{error, info};

#[tauri::command]
pub fn get_tabs() -> Result<Vec<Tab>, String> {
    db::with_db(|conn| Tab::list(conn)).map_err(|e| {
        error!("Failed to get tabs: {}", e);
        e.to_string()
    })
}

#[tauri::command]
pub fn create_tab(name: String) -> Result<i64, String> {
    info!("Creating tab: {}", name);
    db::with_db(|conn| Tab::create(conn, &name)).map_err(|e| {
        error!("Failed to create tab: {}", e);
        e.to_string()
    })
}

#[tauri::command]
pub fn update_tab(id: i64, name: String) -> Result<(), String> {
    info!("Updating tab {}: {}", id, name);
    db::with_db(|conn| Tab::update(conn, id, &name)).map_err(|e| {
        error!("Failed to update tab: {}", e);
        e.to_string()
    })
}

#[tauri::command]
pub fn delete_tab(id: i64) -> Result<(), String> {
    info!("Deleting tab {}", id);
    db::with_db(|conn| Tab::delete(conn, id)).map_err(|e| {
        error!("Failed to delete tab: {}", e);
        e.to_string()
    })
}

#[tauri::command]
pub fn update_tab_orders(orders: Vec<(i64, i32)>) -> Result<(), String> {
    info!("Updating tab orders");
    db::with_db(|conn| {
        for (id, order) in orders {
            Tab::update_order(conn, id, order)?;
        }
        Ok(())
    }).map_err(|e| {
        error!("Failed to update tab orders: {}", e);
        e.to_string()
    })
}
