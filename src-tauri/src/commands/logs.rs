use serde::{Deserialize, Serialize};
use std::sync::Mutex;

const MAX_LOGS: usize = 1000;

static LOGS: std::sync::OnceLock<Mutex<Vec<LogEntry>>> = std::sync::OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
}

#[tauri::command]
pub fn get_logs() -> Vec<LogEntry> {
    let logs = LOGS.get_or_init(|| Mutex::new(Vec::new()));
    logs.lock().map(|guard| guard.clone()).unwrap_or_default()
}

#[tauri::command]
pub fn add_log(level: String, message: String) -> Result<(), String> {
    let logs = LOGS.get_or_init(|| Mutex::new(Vec::new()));
    let mut guard = logs.lock().map_err(|e| e.to_string())?;

    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

    guard.push(LogEntry {
        timestamp,
        level,
        message,
    });

    if guard.len() > MAX_LOGS {
        let remove_count = guard.len() - MAX_LOGS;
        guard.drain(0..remove_count);
    }

    Ok(())
}
