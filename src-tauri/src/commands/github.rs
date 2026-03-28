use flate2::read::GzDecoder;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::path::Path;
use tauri::Emitter;
use tar::Archive;
use tokio::io::AsyncWriteExt;

const BINARY_OWNER: &str = "NicholasDewar";
const BINARY_REPO: &str = "Vaultwarden-Windows-Binary";
const WEBVAULT_OWNER: &str = "dani-garcia";
const WEBVAULT_REPO: &str = "bw_web_builds";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseInfo {
    pub tag: String,
    pub name: String,
    pub body: String,
    pub published_at: String,
    pub html_url: String,
    pub assets: Vec<AssetInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetInfo {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubRelease {
    pub tag_name: String,
    pub name: Option<String>,
    pub body: Option<String>,
    pub published_at: String,
    pub html_url: String,
    pub assets: Vec<GithubAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubAsset {
    pub name: String,
    pub browser_download_url: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebVaultVersion {
    pub version: String,
    pub download_url: String,
    pub size: u64,
}

impl From<GithubRelease> for ReleaseInfo {
    fn from(r: GithubRelease) -> Self {
        ReleaseInfo {
            tag: r.tag_name,
            name: r.name.unwrap_or_default(),
            body: r.body.unwrap_or_default(),
            published_at: r.published_at,
            html_url: r.html_url,
            assets: r.assets.into_iter().map(|a| a.into()).collect(),
        }
    }
}

impl From<GithubAsset> for AssetInfo {
    fn from(a: GithubAsset) -> Self {
        AssetInfo {
            name: a.name,
            browser_download_url: a.browser_download_url,
            size: a.size,
        }
    }
}

fn get_github_release_url(owner: &str, repo: &str) -> String {
    format!("https://api.github.com/repos/{}/{}/releases/latest", owner, repo)
}

fn get_github_releases_url(owner: &str, repo: &str) -> String {
    format!("https://api.github.com/repos/{}/{}/releases", owner, repo)
}

#[tauri::command]
pub async fn get_latest_binary_version() -> Result<String, String> {
    let url = get_github_release_url(BINARY_OWNER, BINARY_REPO);

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "Vaultwarden-GUI")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("API returned status: {}", resp.status()));
    }

    let release: GithubRelease = resp.json().await.map_err(|e| e.to_string())?;
    Ok(release.tag_name)
}

#[tauri::command]
pub async fn check_updates() -> Result<ReleaseInfo, String> {
    let url = get_github_release_url(BINARY_OWNER, BINARY_REPO);

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "Vaultwarden-GUI")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("API returned status: {}", resp.status()));
    }

    let release: GithubRelease = resp.json().await.map_err(|e| e.to_string())?;
    Ok(release.into())
}

#[tauri::command]
pub async fn get_releases() -> Result<Vec<ReleaseInfo>, String> {
    let url = get_github_releases_url(BINARY_OWNER, BINARY_REPO);

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "Vaultwarden-GUI")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("API returned status: {}", resp.status()));
    }

    let releases: Vec<GithubRelease> = resp.json().await.map_err(|e| e.to_string())?;
    Ok(releases.into_iter().map(|r| r.into()).collect())
}

#[tauri::command]
pub async fn download_binary(
    version: String,
    window: tauri::Window,
) -> Result<(), String> {
    let release_url = format!(
        "https://api.github.com/repos/{}/{}/releases/tags/{}",
        BINARY_OWNER, BINARY_REPO, version
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&release_url)
        .header("User-Agent", "Vaultwarden-GUI")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("Failed to get release: {}", resp.status()));
    }

    let release: GithubRelease = resp.json().await.map_err(|e| e.to_string())?;

    let asset = release
        .assets
        .into_iter()
        .find(|a| a.name.contains("windows") && a.name.ends_with(".exe"))
        .ok_or_else(|| "No Windows binary found in release".to_string())?;

    let exe_path = Path::new("vaultwarden.exe");
    let total_size = asset.size;
    let mut downloaded: u64 = 0;

    let response = client
        .get(&asset.browser_download_url)
        .header("User-Agent", "Vaultwarden-GUI")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let mut file = tokio::fs::File::create(exe_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let progress = (downloaded as f64 / total_size as f64 * 100.0) as u8;
        let _ = window.emit("download-progress", serde_json::json!({
            "progress": progress,
            "downloaded": downloaded,
            "total": total_size,
            "file": "vaultwarden.exe"
        }));
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }

    let _ = window.emit("download-complete", serde_json::json!({
        "path": exe_path.to_string_lossy(),
        "file": "vaultwarden.exe"
    }));

    log::info!("Downloaded vaultwarden.exe to {:?}", exe_path);
    Ok(())
}

#[tauri::command]
pub async fn get_latest_webvault_version() -> Result<WebVaultVersion, String> {
    let url = get_github_release_url(WEBVAULT_OWNER, WEBVAULT_REPO);

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .header("User-Agent", "Vaultwarden-GUI")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err(format!("API returned status: {}", resp.status()));
    }

    let release: GithubRelease = resp.json().await.map_err(|e| e.to_string())?;

    let tag = release.tag_name.trim_start_matches('v').to_string();

    let asset = release
        .assets
        .iter()
        .find(|a| a.name.ends_with(".tar.gz") && !a.name.ends_with(".asc"))
        .ok_or_else(|| "No web-vault tarball found".to_string())?;

    Ok(WebVaultVersion {
        version: tag,
        download_url: asset.browser_download_url.clone(),
        size: asset.size,
    })
}

#[tauri::command]
pub async fn download_webvault(window: tauri::Window) -> Result<String, String> {
    let version_info = get_latest_webvault_version().await?;

    std::fs::create_dir_all("web-vault").map_err(|e| e.to_string())?;

    for entry in std::fs::read_dir("web-vault").map_err(|e| e.to_string())? {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_dir() {
                let _ = std::fs::remove_dir_all(&path);
            } else {
                let _ = std::fs::remove_file(&path);
            }
        }
    }

    let tarball_path = Path::new("web-vault.tar.gz");
    let total_size = version_info.size;
    let mut downloaded: u64 = 0;

    let client = reqwest::Client::new();
    let response = client
        .get(&version_info.download_url)
        .header("User-Agent", "Vaultwarden-GUI")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let mut file = tokio::fs::File::create(tarball_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        let progress = (downloaded as f64 / total_size as f64 * 100.0) as u8;
        let _ = window.emit("download-progress", serde_json::json!({
            "progress": progress,
            "downloaded": downloaded,
            "total": total_size,
            "file": "web-vault"
        }));
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }

    let _ = window.emit("download-complete", serde_json::json!({
        "file": "web-vault",
        "status": "extracting"
    }));

    extract_tarball(tarball_path, Path::new("web-vault"))?;

    std::fs::remove_file(tarball_path).ok();

    if !Path::new("web-vault/index.html").exists() {
        let extracted = std::fs::read_dir("web-vault")
            .map_err(|e| e.to_string())?
            .filter_map(|e| e.ok())
            .find(|e| e.path().is_dir() && e.file_name().to_string_lossy().starts_with("bw_web"));

        if let Some(entry) = extracted {
            let inner_dir = entry.path();
            for item in std::fs::read_dir(&inner_dir).map_err(|e| e.to_string())? {
                let item = item.map_err(|e| e.to_string())?;
                let dest = Path::new("web-vault").join(item.file_name());
                if item.path().is_dir() {
                    std::fs::rename(&item.path(), &dest).ok();
                    std::fs::remove_dir_all(&item.path()).ok();
                } else {
                    std::fs::rename(&item.path(), &dest).ok();
                }
            }
            std::fs::remove_dir_all(&inner_dir).ok();
        }
    }

    let _ = window.emit("download-complete", serde_json::json!({
        "file": "web-vault",
        "status": "complete"
    }));

    log::info!("Downloaded and extracted web-vault to web-vault/");
    Ok(version_info.version)
}

fn extract_tarball(tarball_path: &Path, dest_dir: &Path) -> Result<(), String> {
    let tarball = File::open(tarball_path).map_err(|e| e.to_string())?;
    let decoder = GzDecoder::new(tarball);
    let mut archive = Archive::new(decoder);

    for entry in archive.entries().map_err(|e| e.to_string())? {
        let mut entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path().map_err(|e| e.to_string())?;
        
        let cleaned_path: std::path::PathBuf = path
            .components()
            .skip(1)
            .collect();
        
        let dest_path = dest_dir.join(&cleaned_path);
        
        if cleaned_path.to_string_lossy().contains("..") {
            continue;
        }

        if let Some(parent) = dest_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        if cleaned_path.to_string_lossy().ends_with('/') {
            std::fs::create_dir_all(&dest_path).map_err(|e| e.to_string())?;
        } else {
            entry.unpack(&dest_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn check_webvault() -> bool {
    Path::new("web-vault/index.html").exists()
}

#[tauri::command]
pub fn get_webvault_version() -> Option<String> {
    if let Ok(meta) = std::fs::metadata("web-vault") {
        if meta.len() > 0 {
            let js_path = Path::new("web-vault");
            if js_path.join("manifest.json").exists() {
                if let Ok(content) = std::fs::read_to_string(js_path.join("manifest.json")) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        return json.get("version")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                    }
                }
            }
        }
    }
    None
}

#[tauri::command]
pub fn check_binary_exists() -> bool {
    Path::new("vaultwarden.exe").exists()
}

#[tauri::command]
pub fn get_binary_version() -> Option<String> {
    if check_binary_exists() {
        if let Ok(output) = std::process::Command::new("vaultwarden.exe")
            .arg("--version")
            .output()
        {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !version.is_empty() {
                return Some(version);
            }
        }
    }
    None
}
