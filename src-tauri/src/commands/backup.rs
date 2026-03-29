use chrono::Local;
use futures_util::StreamExt;
use tauri::Emitter;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io;
use std::path::Path;
use std::process::Command;
use zip::ZipArchive;
use tokio::io::AsyncWriteExt;

const DEFAULT_BACKUP_DIR: &str = "backups";
const DATABASE_PATH: &str = "data/db.sqlite3";

fn get_sqlite3_path() -> std::path::PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("sqlite3.exe")
}

async fn get_sqlite3_download_url() -> Result<String, String> {
    let client = reqwest::Client::new();
    let html = client
        .get("https://sqlite.org/download.html")
        .header("User-Agent", "Vaultwarden-GUI")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    if let Some(start) = html.find("<!-- Download product data") {
        if let Some(end) = html[start..].find("-->") {
            let comment = &html[start..start + end];

            for line in comment.lines() {
                let trimmed = line.trim();
                if trimmed.starts_with("PRODUCT") && trimmed.contains("sqlite-tools-win-x64") {
                    let parts: Vec<&str> = trimmed.split(',').collect();
                    if parts.len() >= 3 {
                        let relative_url = parts[2].trim();
                        return Ok(format!("https://sqlite.org/{}", relative_url));
                    }
                }
            }
        }
    }

    Err("Failed to find sqlite-tools-win-x64 download URL".to_string())
}

#[tauri::command]
pub fn check_sqlite3_installed() -> bool {
    let sqlite3_path = get_sqlite3_path();
    if sqlite3_path.exists() {
        let output = Command::new(&sqlite3_path)
            .arg("--version")
            .output();
        return output.map(|o| o.status.success()).unwrap_or(false);
    }
    false
}

#[tauri::command]
pub async fn download_sqlite3(window: tauri::Window) -> Result<String, String> {
    let sqlite3_exe = get_sqlite3_path();
    
    if sqlite3_exe.exists() {
        return Ok(sqlite3_exe.to_string_lossy().to_string());
    }

    let app_dir = sqlite3_exe.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| std::path::PathBuf::from("."));
    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;

    let zip_path = app_dir.join("sqlite3.zip");
    
    let _ = window.emit("download-progress", serde_json::json!({
        "progress": 0,
        "downloaded": 0,
        "total": 1,
        "file": "sqlite3"
    }));

    let download_url = get_sqlite3_download_url().await?;

    let client = reqwest::Client::new();
    let response = client
        .get(&download_url)
        .header("User-Agent", "Vaultwarden-GUI")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Failed to download sqlite3: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = tokio::fs::File::create(&zip_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let progress = if total_size > 0 {
            (downloaded as f64 / total_size as f64 * 100.0) as u8
        } else {
            50
        };
        let _ = window.emit("download-progress", serde_json::json!({
            "progress": progress,
            "downloaded": downloaded,
            "total": total_size,
            "file": "sqlite3"
        }));
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }

    let _ = window.emit("download-progress", serde_json::json!({
        "progress": 100,
        "downloaded": downloaded,
        "total": total_size,
        "file": "sqlite3"
    }));

    let file = fs::File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let mut found_sqlite3 = false;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let path = entry.enclosed_name().ok_or("Failed to get enclosed name")?;

        if path.file_name()
            .and_then(|n| n.to_str())
            .map(|n| n.starts_with("sqlite3") && n.ends_with(".exe"))
            .unwrap_or(false)
        {
            let mut outfile = fs::File::create(&sqlite3_exe).map_err(|e| e.to_string())?;
            io::copy(&mut entry, &mut outfile).map_err(|e| e.to_string())?;
            found_sqlite3 = true;
            break;
        }
    }

    fs::remove_file(&zip_path).ok();

    if !found_sqlite3 {
        return Err("sqlite3.exe not found in archive".to_string());
    }

    log::info!("sqlite3 downloaded to {:?}", sqlite3_exe);
    Ok(sqlite3_exe.to_string_lossy().to_string())
}

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

fn resolve_backup_dir(backup_dir: Option<String>) -> Result<String, String> {
    match backup_dir {
        Some(d) => Ok(d),
        None => {
            let config = get_backup_config()?;
            Ok(get_backup_dir(&config))
        }
    }
}

fn get_database_path() -> String {
    DATABASE_PATH.to_string()
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

    let dir = resolve_backup_dir(backup_dir)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let timestamp = Local::now().format("%Y%m%d-%H%M").to_string();
    let filename = format!("vaultwarden_{}.sqlite3", timestamp);
    let backup_path = Path::new(&dir).join(&filename);

    let sqlite3_path = get_sqlite3_path();
    
    if !sqlite3_path.exists() {
        return Err("sqlite3 not found. Please download it first.".to_string());
    }

    let output = Command::new(&sqlite3_path)
        .arg(&db_path)
        .arg(".backup")
        .arg(backup_path.to_str().unwrap())
        .output()
        .map_err(|e| {
            format!(
                "Failed to execute sqlite3: {}",
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
    let dir = resolve_backup_dir(backup_dir)?;

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
    let dir = resolve_backup_dir(backup_dir)?;

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

    let _delete_output = Command::new("schtasks")
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
