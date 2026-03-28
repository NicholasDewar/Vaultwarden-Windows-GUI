use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

const DEFAULT_BACKUP_DIR: &str = "backups";
const DATABASE_PATH: &str = "data/db.sqlite3";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupConfig {
    pub enabled: bool,
    pub interval_minutes: u32,
    pub retention_count: u32,
    pub custom_dir: Option<String>,
    pub require_idle: bool,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            interval_minutes: 10,
            retention_count: 7,
            custom_dir: None,
            require_idle: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub filename: String,
    pub path: String,
    pub size: u64,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivityStatus {
    pub is_active: bool,
    pub last_activity: String,
    pub minutes_since_activity: u32,
}

fn get_backup_dir(config: &BackupConfig) -> String {
    config
        .custom_dir
        .clone()
        .unwrap_or_else(|| DEFAULT_BACKUP_DIR.to_string())
}

fn get_database_path() -> String {
    DATABASE_PATH.to_string()
}

fn format_size(size: u64) -> String {
    if size < 1024 {
        format!("{} B", size)
    } else if size < 1024 * 1024 {
        format!("{:.1} KB", size as f64 / 1024.0)
    } else {
        format!("{:.1} MB", size as f64 / (1024.0 * 1024.0))
    }
}

#[tauri::command]
pub fn get_backup_config() -> Result<BackupConfig, String> {
    let config_path = get_config_path()?;

    if !config_path.exists() {
        return Ok(BackupConfig::default());
    }

    let json = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let config: BackupConfig = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
pub fn save_backup_config(config: BackupConfig) -> Result<(), String> {
    let config_path = get_config_path()?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&config_path, json).map_err(|e| e.to_string())?;
    log::info!("Backup config saved");
    Ok(())
}

fn get_config_path() -> Result<std::path::PathBuf, String> {
    let config_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));

    let config_path = config_dir.join("backup_config.json");

    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    Ok(config_path)
}

#[tauri::command]
pub fn backup_database(backup_dir: Option<String>) -> Result<BackupInfo, String> {
    let db_path = get_database_path();

    if !Path::new(&db_path).exists() {
        return Err(format!("Database not found at: {}", db_path));
    }

    let dir = backup_dir.unwrap_or_else(|| DEFAULT_BACKUP_DIR.to_string());
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let timestamp = Local::now().format("%Y%m%d-%H%M").to_string();
    let filename = format!("vaultwarden_{}.sqlite3", timestamp);
    let backup_path = Path::new(&dir).join(&filename);

    let output = Command::new("sqlite3")
        .arg(&db_path)
        .arg(".backup")
        .arg(backup_path.to_str().unwrap())
        .output()
        .map_err(|e| {
            format!(
                "Failed to execute sqlite3: {}. Make sure SQLite3 is installed.",
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Backup failed: {}", stderr));
    }

    let metadata = fs::metadata(&backup_path).map_err(|e| e.to_string())?;

    log::info!("Database backed up to {:?}", backup_path);

    Ok(BackupInfo {
        filename,
        path: backup_path.to_string_lossy().to_string(),
        size: metadata.len(),
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub fn list_backups(backup_dir: Option<String>) -> Result<Vec<BackupInfo>, String> {
    let dir = backup_dir.unwrap_or_else(|| DEFAULT_BACKUP_DIR.to_string());

    if !Path::new(&dir).exists() {
        return Ok(Vec::new());
    }

    let mut backups = Vec::new();

    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.is_file() && path.extension().map_or(false, |ext| ext == "sqlite3") {
            if let Ok(metadata) = fs::metadata(&path) {
                let filename = path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                let created_at = metadata
                    .created()
                    .ok()
                    .and_then(|t| t.elapsed().ok())
                    .map(|_| Local::now().format("%Y-%m-%d %H:%M:%S").to_string())
                    .unwrap_or_else(|| "Unknown".to_string());

                backups.push(BackupInfo {
                    filename,
                    path: path.to_string_lossy().to_string(),
                    size: metadata.len(),
                    created_at,
                });
            }
        }
    }

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(backups)
}

#[tauri::command]
pub fn delete_backup(backup_path: String) -> Result<(), String> {
    fs::remove_file(&backup_path).map_err(|e| e.to_string())?;
    log::info!("Backup deleted: {}", backup_path);
    Ok(())
}

#[tauri::command]
pub fn cleanup_old_backups(
    backup_dir: Option<String>,
    retention_count: u32,
) -> Result<u32, String> {
    let dir = backup_dir.unwrap_or_else(|| DEFAULT_BACKUP_DIR.to_string());

    if !Path::new(&dir).exists() {
        return Ok(0);
    }

    let mut backups = list_backups(Some(dir.clone()))?;

    if backups.len() <= retention_count as usize {
        return Ok(0);
    }

    let to_delete = backups.split_off(retention_count as usize);
    let mut deleted = 0;

    for backup in to_delete {
        if fs::remove_file(&backup.path).is_ok() {
            deleted += 1;
        }
    }

    log::info!("Cleaned up {} old backups", deleted);
    Ok(deleted)
}

#[tauri::command]
pub fn check_database_activity() -> Result<ActivityStatus, String> {
    let db_path = get_database_path();

    let (is_active, last_activity) = if Path::new(&db_path).exists() {
        if let Ok(metadata) = fs::metadata(&db_path) {
            if let Ok(modified) = metadata.modified() {
                let elapsed = std::time::SystemTime::now()
                    .duration_since(modified)
                    .map(|d| d.as_secs() / 60)
                    .unwrap_or(0) as u32;

                let last_activity = Local::now()
                    .checked_sub_signed(chrono::Duration::minutes(elapsed as i64))
                    .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                    .unwrap_or_else(|| "Unknown".to_string());

                (elapsed < 10, last_activity)
            } else {
                (true, "Unknown".to_string())
            }
        } else {
            (true, "Unknown".to_string())
        }
    } else {
        (false, "No database".to_string())
    };

    Ok(ActivityStatus {
        is_active: !is_active,
        minutes_since_activity: if is_active { 0 } else { 10 },
        last_activity,
    })
}

#[tauri::command]
pub fn restore_backup(backup_path: String) -> Result<(), String> {
    let db_path = get_database_path();

    if !Path::new(&backup_path).exists() {
        return Err(format!("Backup file not found: {}", backup_path));
    }

    fs::copy(&backup_path, &db_path).map_err(|e| e.to_string())?;

    log::info!("Database restored from: {}", backup_path);
    Ok(())
}

#[tauri::command]
pub fn check_database_exists() -> bool {
    Path::new(DATABASE_PATH).exists()
}

#[tauri::command]
pub fn get_last_backup_time(backup_dir: Option<String>) -> Result<Option<String>, String> {
    let backups = list_backups(backup_dir)?;

    Ok(backups.first().map(|b| b.created_at.clone()))
}

#[tauri::command]
pub fn create_scheduled_task(interval_minutes: u32) -> Result<(), String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();

    let task_name = "VaultwardenManager_Backup";

    let delete_output = Command::new("schtasks")
        .args(&["/Delete", "/TN", task_name, "/F"])
        .output();

    let create_output = Command::new("schtasks")
        .args(&[
            "/Create",
            "/TN",
            task_name,
            "/TR",
            &format!("\"{}\" --backup", exe_path),
            "/SC",
            "MINUTE",
            "/MO",
            &interval_minutes.to_string(),
            "/F",
        ])
        .output()
        .map_err(|e| format!("Failed to create scheduled task: {}", e))?;

    if !create_output.status.success() {
        let stderr = String::from_utf8_lossy(&create_output.stderr);
        return Err(format!("Failed to create scheduled task: {}", stderr));
    }

    log::info!(
        "Scheduled task created with interval: {} minutes",
        interval_minutes
    );
    Ok(())
}

#[tauri::command]
pub fn delete_scheduled_task() -> Result<(), String> {
    let task_name = "VaultwardenManager_Backup";

    let output = Command::new("schtasks")
        .args(&["/Delete", "/TN", task_name, "/F"])
        .output()
        .map_err(|e| format!("Failed to delete scheduled task: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to delete scheduled task: {}", stderr));
    }

    log::info!("Scheduled task deleted");
    Ok(())
}

#[tauri::command]
pub fn check_scheduled_task_exists() -> bool {
    let task_name = "VaultwardenManager_Backup";

    let output = Command::new("schtasks")
        .args(&["/Query", "/TN", task_name])
        .output();

    output.map(|o| o.status.success()).unwrap_or(false)
}
