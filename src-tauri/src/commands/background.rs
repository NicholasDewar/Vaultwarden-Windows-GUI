use std::time::Duration;
use std::os::windows::process::CommandExt;
use tauri::{AppHandle, Emitter};
use tauri::async_runtime::spawn;
use tokio::time::sleep;

use crate::commands::process::{CertToolsStatus, ValidationResult};

pub struct BackgroundTasks {
    app_handle: AppHandle,
}

impl BackgroundTasks {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    pub fn start(&self) {
        let app = self.app_handle.clone();
        spawn(async move {
            let status = get_status_internal();
            let _ = app.emit("status-changed", status);

            let config = crate::commands::config::load_config_internal();
            let _ = app.emit("config-loaded", config);

            spawn(Self::check_cert_tools(app.clone()));
            spawn(Self::check_versions(app.clone()));
            spawn(Self::poll_status(app));
        });
    }

    async fn check_cert_tools(app: AppHandle) {
        let openssl_available = check_openssl_internal();
        let mkcert_available = check_mkcert_internal();
        let mkcert_ca_installed = if mkcert_available {
            check_mkcert_ca_installed_internal()
        } else {
            false
        };

        let status = CertToolsStatus {
            openssl_available,
            mkcert_available,
            mkcert_ca_installed,
        };

        let _ = app.emit("cert-tools-status", status);
    }

    async fn check_versions(app: AppHandle) {
        let binary_latest = get_latest_binary_version_internal().await;
        let webvault_latest = get_latest_webvault_version_internal().await;
        let binary_version = get_binary_version_internal();
        let webvault_version = get_webvault_version_internal();
        let validation = validate_environment_internal();

        let payload = serde_json::json!({
            "binaryLatestVersion": binary_latest.unwrap_or_default(),
            "webvaultLatestVersion": webvault_latest.map(|v| v.version).unwrap_or_default(),
            "binaryVersion": binary_version.unwrap_or_default(),
            "webvaultVersion": webvault_version.unwrap_or_default(),
            "validation": validation,
        });

        let _ = app.emit("versions-checked", payload);
    }

    async fn poll_status(app: AppHandle) {
        sleep(Duration::from_secs(5)).await;
        loop {
            let status = get_status_internal();
            let _ = app.emit("status-changed", status);
            sleep(Duration::from_secs(5)).await;
        }
    }
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn check_openssl_internal() -> bool {
    let mut cmd = std::process::Command::new("openssl");
    cmd.arg("version");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn check_mkcert_internal() -> bool {
    let mut cmd = std::process::Command::new("mkcert");
    cmd.arg("-version");
    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd.output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn check_mkcert_ca_installed_internal() -> bool {
    let localappdata = std::env::var("LOCALAPPDATA").ok();
    if let Some(localappdata) = localappdata {
        let mkcert_dir = std::path::Path::new(&localappdata).join("mkcert");
        let root_key = mkcert_dir.join("rootCAKey.pem");
        let root_cert = mkcert_dir.join("rootCApem");
        return root_key.exists() && root_cert.exists();
    }
    false
}

async fn get_latest_binary_version_internal() -> Option<String> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        "NicholasDewar", "Vaultwarden-Windows-Binary"
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "Vaultwarden-GUI")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let release: serde_json::Value = resp.json().await.ok()?;
    release.get("tag_name")?.as_str().map(|s| s.to_string())
}

async fn get_latest_webvault_version_internal() -> Option<crate::commands::github::WebVaultVersion> {
    let url = format!(
        "https://api.github.com/repos/{}/{}/releases/latest",
        "dani-garcia", "bw_web_builds"
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "Vaultwarden-GUI")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .ok()?;

    if !resp.status().is_success() {
        return None;
    }

    let release: serde_json::Value = resp.json().await.ok()?;
    
    let tag = release.get("tag_name")?.as_str()?.trim_start_matches('v').to_string();
    
    let assets = release.get("assets")?.as_array()?;
    let asset = assets.iter().find(|a| {
        let name = a.get("name").and_then(|n| n.as_str()).unwrap_or("");
        name.ends_with(".tar.gz") && !name.ends_with(".asc")
    })?;

    Some(crate::commands::github::WebVaultVersion {
        version: tag,
        download_url: asset.get("browser_download_url")?.as_str()?.to_string(),
        size: asset.get("size")?.as_u64().unwrap_or(0),
    })
}

fn get_binary_version_internal() -> Option<String> {
    if !std::path::Path::new("vaultwarden.exe").exists() {
        return None;
    }

    if let Ok(output) = std::process::Command::new("vaultwarden.exe")
        .arg("--version")
        .output()
    {
        let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !version.is_empty() {
            return Some(version);
        }
    }
    None
}

fn get_webvault_version_internal() -> Option<String> {
    if !std::path::Path::new("web-vault/index.html").exists() {
        return None;
    }

    if let Ok(content) = std::fs::read_to_string("web-vault/manifest.json") {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            return json.get("version")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
        }
    }
    None
}

fn validate_environment_internal() -> ValidationResult {
    let config = crate::commands::config::load_config_internal();
    
    let binary_exists = std::path::Path::new("vaultwarden.exe").exists();
    let webvault_exists = std::path::Path::new("web-vault/index.html").exists();
    let cert_exists = std::path::Path::new(&config.cert_path).exists();
    let key_exists = std::path::Path::new(&config.key_path).exists();

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

fn get_status_internal() -> bool {
    if let Some(process_mutex) = crate::commands::process::VAULTWARDEN_PROCESS.get() {
        if let Ok(guard) = process_mutex.lock() {
            return guard.is_some();
        }
    }
    false
}
