use std::path::Path;
use std::process::Stdio;
use std::sync::Mutex;
use tauri::Emitter;
use tokio::io::{AsyncBufReadExt, BufReader as AsyncBufReader};
use tokio::process::{Child, Command};
use tokio::sync::oneshot;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub(crate) static VAULTWARDEN_PROCESS: std::sync::OnceLock<Mutex<Option<Child>>> =
    std::sync::OnceLock::new();

pub(crate) static READER_ABORT_HANDLES: std::sync::OnceLock<Mutex<Option<Vec<oneshot::Sender<()>>>>> =
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

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CertToolsStatus {
    pub openssl_available: bool,
    pub mkcert_available: bool,
    pub mkcert_ca_installed: bool,
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub async fn start_vaultwarden(config: VaultwardenConfig, window: tauri::Window) -> Result<(), String> {
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

    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if config.enable_tls {
        cmd.env(
            "ROCKET_TLS",
            format!(
                "{{certs=\"{}\",key=\"{}\"}}",
                config.cert_path, config.key_path
            ),
        );
    }

    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn vaultwarden: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let (stdout_abort_tx, stdout_abort_rx) = oneshot::channel::<()>();
    let (stderr_abort_tx, stderr_abort_rx) = oneshot::channel::<()>();

    let window_clone = window.clone();
    tokio::spawn(async move {
        let mut reader = AsyncBufReader::new(stdout).lines();
        loop {
            tokio::select! {
                result = reader.next_line() => {
                    match result {
                        Ok(Some(line)) => {
                            let _ = window_clone.emit(
                                "vaultwarden-log",
                                serde_json::json!({
                                    "level": "INFO",
                                    "message": line
                                }),
                            );
                        }
                        Ok(None) => break,
                        Err(e) => {
                            log::debug!("stdout reader ended: {}", e);
                            break;
                        }
                    }
                }
                _ = stdout_abort_rx => {
                    log::debug!("stdout reader aborted");
                    break;
                }
            }
        }
    });

    let window_clone = window.clone();
    tokio::spawn(async move {
        let mut reader = AsyncBufReader::new(stderr).lines();
        loop {
            tokio::select! {
                result = reader.next_line() => {
                    match result {
                        Ok(Some(line)) => {
                            let level = if line.to_lowercase().contains("error") {
                                "ERROR"
                            } else if line.to_lowercase().contains("warn") {
                                "WARN"
                            } else {
                                "INFO"
                            };
                            let _ = window_clone.emit(
                                "vaultwarden-log",
                                serde_json::json!({
                                    "level": level,
                                    "message": line
                                }),
                            );
                        }
                        Ok(None) => break,
                        Err(e) => {
                            log::debug!("stderr reader ended: {}", e);
                            break;
                        }
                    }
                }
                _ = stderr_abort_rx => {
                    log::debug!("stderr reader aborted");
                    break;
                }
            }
        }
    });

    let process_mutex = VAULTWARDEN_PROCESS.get_or_init(|| Mutex::new(None));
    let mut guard = process_mutex.lock().map_err(|e| format!("Lock error: {}", e))?;
    *guard = Some(child);

    let abort_mutex = READER_ABORT_HANDLES.get_or_init(|| Mutex::new(None));
    let mut abort_guard = abort_mutex.lock().map_err(|e| format!("Lock error: {}", e))?;
    *abort_guard = Some(vec![stdout_abort_tx, stderr_abort_tx]);

    let _ = window.emit("status-changed", true);

    log::info!("Vaultwarden started with config: {:?}", config);
    Ok(())
}

#[tauri::command]
pub async fn stop_vaultwarden() -> Result<(), String> {
    if let Some(abort_mutex) = READER_ABORT_HANDLES.get() {
        if let Ok(mut guard) = abort_mutex.lock() {
            if let Some(abort_handles) = guard.take() {
                for tx in abort_handles {
                    let _ = tx.send(());
                }
                log::debug!("Reader abort signals sent");
            }
        }
    }

    let process_mutex = VAULTWARDEN_PROCESS.get_or_init(|| Mutex::new(None));
    let child_opt = {
        let mut guard = process_mutex.lock().map_err(|e| format!("Lock error: {}", e))?;
        guard.take()
    };

    if let Some(mut child) = child_opt {
        match child.kill().await {
            Ok(()) => {
                log::info!("Vaultwarden kill signal sent successfully");
            }
            Err(e) => {
                log::warn!("Failed to send kill signal: {}. Process may already be terminated.", e);
            }
        }
        
        match child.wait().await {
            Ok(status) => {
                log::info!("Vaultwarden process exited with status: {}", status);
            }
            Err(e) => {
                log::warn!("Failed to wait for process: {}", e);
            }
        }
    } else {
        log::debug!("No vaultwarden process to stop");
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

    let mut cmd = std::process::Command::new("where");
    cmd.arg("vaultwarden.exe");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    if let Ok(output) = cmd.output() {
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

    let is_ready =
        binary_exists && webvault_exists && (!config.enable_tls || (cert_exists && key_exists));

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
        .map_err(|e| {
            format!(
                "Failed to run openssl: {}. Make sure OpenSSL is installed.",
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to generate certificates: {}", stderr));
    }

    log::info!("Generated certificates: {} and {}", cert_path, key_path);
    Ok(())
}

#[tauri::command]
pub fn check_openssl_available() -> bool {
    let mut cmd = std::process::Command::new("openssl");
    cmd.arg("version");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub fn check_cert_tools_available() -> Result<CertToolsStatus, String> {
    let mut openssl_cmd = std::process::Command::new("openssl");
    openssl_cmd.arg("version");
    #[cfg(windows)]
    openssl_cmd.creation_flags(CREATE_NO_WINDOW);
    let openssl_available = openssl_cmd
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let mut mkcert_cmd = std::process::Command::new("mkcert");
    mkcert_cmd.arg("-version");
    #[cfg(windows)]
    mkcert_cmd.creation_flags(CREATE_NO_WINDOW);
    let mkcert_available = mkcert_cmd
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    let mkcert_ca_installed = if mkcert_available {
        check_mkcert_ca_installed()
    } else {
        false
    };

    Ok(CertToolsStatus {
        openssl_available,
        mkcert_available,
        mkcert_ca_installed,
    })
}

fn check_mkcert_ca_installed() -> bool {
    let localappdata = std::env::var("LOCALAPPDATA").ok();
    if let Some(localappdata) = localappdata {
        let mkcert_dir = std::path::Path::new(&localappdata).join("mkcert");
        let root_key = mkcert_dir.join("rootCAKey.pem");
        let root_cert = mkcert_dir.join("rootCApem");
        return root_key.exists() && root_cert.exists();
    }
    false
}

#[tauri::command]
pub fn check_mkcert_available() -> bool {
    let mut cmd = std::process::Command::new("mkcert");
    cmd.arg("-version");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

#[tauri::command]
pub fn is_mkcert_ca_installed() -> bool {
    check_mkcert_ca_installed()
}

#[tauri::command]
pub fn install_mkcert_ca() -> Result<(), String> {
    let mut cmd = std::process::Command::new("mkcert");
    cmd.arg("-install");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run mkcert -install: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to install mkcert CA: {}", stderr));
    }

    log::info!("mkcert CA installed successfully");
    Ok(())
}

#[tauri::command]
pub fn generate_certificates_with_tool(
    cert_path: String,
    key_path: String,
    ip: String,
    tool: String,
) -> Result<(), String> {
    match tool.as_str() {
        "mkcert" => generate_cert_with_mkcert(&cert_path, &key_path, &ip),
        "openssl" | _ => generate_cert_with_openssl(&cert_path, &key_path, &ip),
    }
}

fn generate_cert_with_mkcert(cert_path: &str, key_path: &str, ip: &str) -> Result<(), String> {
    let mut cmd = std::process::Command::new("mkcert");
    cmd.args(&[
        "-key-file",
        key_path,
        "-cert-file",
        cert_path,
        "localhost",
        "127.0.0.1",
        "::1",
        ip,
    ]);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd
        .output()
        .map_err(|e| {
            format!(
                "Failed to run mkcert: {}. Make sure mkcert is installed.",
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Failed to generate certificates with mkcert: {}",
            stderr
        ));
    }

    log::info!(
        "Generated certificates with mkcert: {} and {}",
        cert_path,
        key_path
    );
    Ok(())
}

fn generate_cert_with_openssl(cert_path: &str, key_path: &str, ip: &str) -> Result<(), String> {
    let mut cmd = std::process::Command::new("openssl");
    cmd.args(&[
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "3650",
        "-keyout",
        key_path,
        "-out",
        cert_path,
        "-subj",
        "/CN=localhost",
        "-addext",
        &format!("subjectAltName=DNS:localhost,IP:127.0.0.1,IP:{}", ip),
    ]);
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    let output = cmd
        .output()
        .map_err(|e| {
            format!(
                "Failed to run OpenSSL: {}. Make sure OpenSSL is installed.",
                e
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Failed to generate certificates with OpenSSL: {}",
            stderr
        ));
    }

    log::info!(
        "Generated certificates with OpenSSL: {} and {}",
        cert_path,
        key_path
    );
    Ok(())
}
