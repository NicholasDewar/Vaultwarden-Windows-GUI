use std::fs;
use std::path::PathBuf;

use super::process::VaultwardenConfig;
use super::utils::write_atomic_string;

fn get_config_path() -> Result<PathBuf, String> {
    let config_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let config_path = config_dir.join("config.json");

    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    Ok(config_path)
}

fn get_language_path() -> Result<PathBuf, String> {
    let config_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));

    let config_path = config_dir.join("language.json");

    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    Ok(config_path)
}

#[tauri::command]
pub fn save_config(config: VaultwardenConfig) -> Result<(), String> {
    let config_path = get_config_path()?;
    let json =
        serde_json::to_string_pretty(&config).map_err(|e| format!("Serialization error: {}", e))?;

    if let Some(parent) = config_path.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create config directory: {}", e))?;
        }
    }

    write_atomic_string(&config_path, &json)?;
    log::info!("Config saved to {:?}", config_path);
    log::debug!("Config content: {}", json);
    Ok(())
}

#[tauri::command]
pub fn load_config() -> Result<VaultwardenConfig, String> {
    Ok(load_config_internal())
}

pub fn load_config_internal() -> VaultwardenConfig {
    let config_path = match get_config_path() {
        Ok(p) => p,
        Err(_) => return VaultwardenConfig::default(),
    };

    if !config_path.exists() {
        log::info!("Config file not found, using default");
        return VaultwardenConfig::default();
    }

    match fs::read_to_string(&config_path) {
        Ok(json) => match serde_json::from_str::<VaultwardenConfig>(&json) {
            Ok(config) => {
                log::info!("Config loaded from {:?}", config_path);
                config
            }
            Err(e) => {
                log::error!("Failed to parse config: {}", e);
                VaultwardenConfig::default()
            }
        },
        Err(e) => {
            log::error!("Failed to read config: {}", e);
            VaultwardenConfig::default()
        }
    }
}

#[tauri::command]
pub fn set_language(lang: String) -> Result<(), String> {
    let path = get_language_path()?;
    write_atomic_string(&path, &lang)?;
    log::info!("Language set to: {:?}", path);
    Ok(())
}

#[tauri::command]
pub fn get_language() -> Result<String, String> {
    let path = get_language_path()?;

    if !path.exists() {
        return Ok("zh".to_string());
    }

    fs::read_to_string(&path).map_err(|e| e.to_string())
}
