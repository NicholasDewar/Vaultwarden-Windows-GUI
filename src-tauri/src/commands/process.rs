use std::path::Path;
use std::process::Stdio;
use tauri::Emitter;
use std::sync::Mutex;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

static VAULTWARDEN_PROCESS: std::sync::OnceLock<Mutex<Option<tokio::process::Child>>> =
    std::sync::OnceLock::new();

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VaultwardenConfig {
    pub address: String,
    pub port: u16,
    pub domain: String,
    pub enable_tls: bool,
    pub cert_path: String,
    pub key_path: String,
    pub data_folder: String,
}

impl Default for VaultwardenConfig {
    fn default() -> Self {
        Self {
            address: "0.0.0.0".to_string(),
            port: 8443,
            domain: "https://127.0.0.1:8443".to_string(),
            enable_tls: true,
            cert_path: "localhost.crt".to_string(),
            key_path: "localhost.key".to_string(),
            data_folder: "data".to_string(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ValidationResult {
    pub binary_exists: bool,
    pub webvault_exists: bool,
    pub cert_exists: bool,
    pub key_exists: bool,
    pub is_ready: bool,
    pub missing_items: Vec<String>,
}

#[tauri::command]
pub async fn start_vaultwarden(
    config: VaultwardenConfig,
    window: tauri::Window,
) -> Result<(), String> {
    let _ = stop_vaultwarden().await;

    let vaultwarden_exe = find_vaultwarden_exe()?;

    std::fs::create_dir_all(&config.data_folder).map_err(|e| e.to_string())?;

    let mut cmd = Command::new(&vaultwarden_exe);
    cmd.env("ROCKET_ADDRESS", &config.address)
        .env("ROCKET_PORT", config.port.to_string())
        .env("DOMAIN", &config.domain)
        .env("DATA_FOLDER", &config.data_folder)
        .env("RUST_LOG", "info")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    if config.enable_tls {
        cmd.env("ROCKET_TLS", format!(
            "{{certs=\"{}\",key=\"{}\"}}",
            config.cert_path, config.key_path
        ));
    }

    let mut child = cmd.spawn().map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let window_clone = window.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let _ = window_clone.emit("vaultwarden-log", serde_json::json!({
                "level": "INFO",
                "message": line
            }));
        }
    });

    let window_clone = window.clone();
    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let level = if line.to_lowercase().contains("error") {
                "ERROR"
            } else if line.to_lowercase().contains("warn") {
                "WARN"
            } else {
                "INFO"
            };
            let _ = window_clone.emit("vaultwarden-log", serde_json::json!({
                "level": level,
                "message": line
            }));
        }
    });

    let process_mutex = VAULTWARDEN_PROCESS.get_or_init(|| Mutex::new(None));
    let mut guard = process_mutex.lock().map_err(|e| e.to_string())?;
    *guard = Some(child);

    let _ = window.emit("status-changed", true);

    log::info!("Vaultwarden started with config: {:?}", config);
    Ok(())
}

#[tauri::command]
pub async fn stop_vaultwarden() -> Result<(), String> {
    let process_mutex = VAULTWARDEN_PROCESS.get_or_init(|| Mutex::new(None));
    let child_opt = {
        let mut guard = process_mutex.lock().map_err(|e| e.to_string())?;
        guard.take()
    };

    if let Some(mut child) = child_opt {
        child.kill().await.map_err(|e| e.to_string())?;
        child.wait().await.map_err(|e| e.to_string())?;
        log::info!("Vaultwarden stopped");
    }

    Ok(())
}

#[tauri::command]
pub fn get_status() -> bool {
    if let Some(process_mutex) = VAULTWARDEN_PROCESS.get() {
        if let Ok(guard) = process_mutex.lock() {
            return guard.is_some();
        }
    }
    false
}

fn find_vaultwarden_exe() -> Result<String, String> {
    let exe_path = Path::new("vaultwarden.exe");
    if exe_path.exists() {
        return Ok(exe_path.to_string_lossy().to_string());
    }

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_default();

    let exe_in_dir = exe_dir.join("vaultwarden.exe");
    if exe_in_dir.exists() {
        return Ok(exe_in_dir.to_string_lossy().to_string());
    }

    if let Ok(output) = std::process::Command::new("where")
        .arg("vaultwarden.exe")
        .output()
    {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Some(line) = stdout.lines().next() {
            let path = line.trim();
            if Path::new(path).exists() {
                return Ok(path.to_string());
            }
        }
    }

    Err("vaultwarden.exe not found. Please download it first.".to_string())
}

#[tauri::command]
pub fn validate_environment(config: VaultwardenConfig) -> ValidationResult {
    let binary_exists = Path::new("vaultwarden.exe").exists();
    let webvault_exists = Path::new("web-vault/index.html").exists();
    let cert_exists = Path::new(&config.cert_path).exists();
    let key_exists = Path::new(&config.key_path).exists();

    let mut missing_items = Vec::new();

    if !binary_exists {
        missing_items.push("vaultwarden.exe".to_string());
    }
    if !webvault_exists {
        missing_items.push("web-vault".to_string());
    }
    if config.enable_tls {
        if !cert_exists {
            missing_items.push(format!("{} (certificate)", config.cert_path));
        }
        if !key_exists {
            missing_items.push(format!("{} (key)", config.key_path));
        }
    }

    let is_ready = binary_exists && webvault_exists && (!config.enable_tls || (cert_exists && key_exists));

    ValidationResult {
        binary_exists,
        webvault_exists,
        cert_exists,
        key_exists,
        is_ready,
        missing_items,
    }
}

#[tauri::command]
pub fn generate_certificates(
    cert_path: String,
    key_path: String,
    ip: String,
) -> Result<(), String> {
    let output = std::process::Command::new("openssl")
        .args(&[
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-nodes",
            "-days",
            "3650",
            "-keyout",
            &key_path,
            "-out",
            &cert_path,
            "-subj",
            "/CN=localhost",
            "-addext",
            &format!("subjectAltName=DNS:localhost,IP:127.0.0.1,IP:{}", ip),
        ])
        .output()
        .map_err(|e| format!("Failed to run openssl: {}. Make sure OpenSSL is installed.", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to generate certificates: {}", stderr));
    }

    log::info!("Generated certificates: {} and {}", cert_path, key_path);
    Ok(())
}

#[tauri::command]
pub fn check_openssl_available() -> bool {
    std::process::Command::new("openssl")
        .arg("version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}
