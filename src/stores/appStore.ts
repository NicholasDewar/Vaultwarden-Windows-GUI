import { createSignal, createRoot, onCleanup } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";

export interface ReleaseInfo {
  tag: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  assets: AssetInfo[];
}

export interface AssetInfo {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface NetworkInterface {
  name: string;
  ip: string;
  type: string;
}

export interface VaultwardenConfig {
  address: string;
  port: number;
  domain: string;
  enable_tls: boolean;
  cert_path: string;
  key_path: string;
  data_folder: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface ValidationResult {
  binary_exists: boolean;
  webvault_exists: boolean;
  cert_exists: boolean;
  key_exists: boolean;
  is_ready: boolean;
  missing_items: string[];
}

export interface CertToolsStatus {
  openssl_available: boolean;
  mkcert_available: boolean;
  mkcert_ca_installed: boolean;
}

export interface WebVaultVersion {
  version: string;
  download_url: string;
  size: number;
}

export interface GuiUpdateInfo {
  current_version: string;
  latest_version: string;
  is_outdated: boolean;
  download_url: string;
  release_notes: string;
}

export interface BackupConfig {
  enabled: boolean;
  min_diff_interval: number;
  retention_count: number;
  custom_dir: string | null;
}

export interface BackupInfo {
  filename: string;
  path: string;
  size: number;
  created_at: string;
}

export interface ActivityStatus {
  is_active: boolean;
  last_activity: string;
  minutes_since_activity: number;
}

function createAppStore() {
  const [isRunning, setIsRunning] = createSignal(false);
  const [binaryVersion, setBinaryVersion] = createSignal("");
  const [binaryLatestVersion, setBinaryLatestVersion] = createSignal("");
  const [hasBinaryUpdate, setHasBinaryUpdate] = createSignal(false);
  const [hasWebvaultUpdate, setHasWebvaultUpdate] = createSignal(false);
  const [webvaultVersion, setWebvaultVersion] = createSignal("");
  const [webvaultLatestVersion, setWebvaultLatestVersion] = createSignal("");
  const [releases, setReleases] = createSignal<ReleaseInfo[]>([]);
  const [networkIps, setNetworkIps] = createSignal<NetworkInterface[]>([]);
  const [selectedIp, setSelectedIp] = createSignal("");
  const [config, setConfig] = createSignal<VaultwardenConfig>({
    address: "0.0.0.0",
    port: 8443,
    domain: "https://127.0.0.1:8443",
    enable_tls: true,
    cert_path: "localhost.crt",
    key_path: "localhost.key",
    data_folder: "data",
  });
  const [logs, setLogs] = createSignal<LogEntry[]>([]);
  const [isCheckingUpdate, setIsCheckingUpdate] = createSignal(false);
  const [guiUpdate, setGuiUpdate] = createSignal<GuiUpdateInfo | null>(null);
  const [isDownloadingGui, setIsDownloadingGui] = createSignal(false);
  const [downloadGuiProgress, setDownloadGuiProgress] = createSignal(0);
  const [isDownloading, setIsDownloading] = createSignal(false);
  const [downloadProgress, setDownloadProgress] = createSignal(0);
  const [downloadFile, setDownloadFile] = createSignal("");
  const [validation, setValidation] = createSignal<ValidationResult | null>(null);
  const [opensslAvailable, setOpensslAvailable] = createSignal(true);
  const [certTool, setCertTool] = createSignal<'openssl' | 'mkcert'>('mkcert');
  const [certToolsStatus, setCertToolsStatus] = createSignal<CertToolsStatus | null>(null);
  const [isGeneratingCerts, setIsGeneratingCerts] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [successMessage, setSuccessMessage] = createSignal<string | null>(null);

  const [backupConfig, setBackupConfig] = createSignal<BackupConfig>({
    enabled: false,
    min_diff_interval: 5,
    retention_count: 7,
    custom_dir: null,
  });
  const [backups, setBackups] = createSignal<BackupInfo[]>([]);
  const [lastBackup, setLastBackup] = createSignal<string | null>(null);
  const [isBackingUp, setIsBackingUp] = createSignal(false);
  const [activityStatus, setActivityStatus] = createSignal<ActivityStatus | null>(null);
  const [showBackupWarning, setShowBackupWarning] = createSignal(false);
  const [sqlite3Installed, setSqlite3Installed] = createSignal(false);
  const [needsSqlite3Download, setNeedsSqlite3Download] = createSignal(false);
  const [autostartEnabled, setAutostartEnabled] = createSignal(false);

  const defaultConfig: VaultwardenConfig = {
    address: "0.0.0.0",
    port: 8443,
    domain: "https://127.0.0.1:8443",
    enable_tls: true,
    cert_path: "localhost.crt",
    key_path: "localhost.key",
    data_folder: "data",
  };

  const loadConfig = async () => {
    try {
      const cfg = await invoke<VaultwardenConfig>("load_config");
      setConfig(cfg);
      console.info("Config loaded successfully");
    } catch (e) {
      console.error("Failed to load config:", e);
      throw e;
    }
  };

  const saveConfig = async (cfg: VaultwardenConfig) => {
    try {
      await invoke("save_config", { config: cfg });
      setConfig(cfg);
    } catch (e) {
      console.error("Failed to save config:", e);
      throw e;
    }
  };

  const checkBinaryVersion = async () => {
    try {
      const exists = await invoke<boolean>("check_binary_exists");
      if (exists) {
        const version = await invoke<string | null>("get_binary_version");
        setBinaryVersion(version || "");
      } else {
        setBinaryVersion("");
      }
    } catch (e) {
      console.error("Failed to check binary version:", e);
    }
  };

  const checkWebvaultVersion = async () => {
    try {
      const exists = await invoke<boolean>("check_webvault");
      if (exists) {
        const version = await invoke<string | null>("get_webvault_version");
        setWebvaultVersion(version || "");
      } else {
        setWebvaultVersion("");
      }
    } catch (e) {
      console.error("Failed to check webvault version:", e);
    }
  };

  const checkAllVersions = async () => {
    setIsCheckingUpdate(true);
    setError(null);
    try {
      const updateInfo = await invoke<{
        current_version: string | null;
        latest_version: string | null;
        has_update: boolean;
        webvault_version: string | null;
        webvault_latest: string | null;
        webvault_has_update: boolean;
      }>("check_binary_update");
      
      setBinaryVersion(updateInfo.current_version || "");
      setBinaryLatestVersion(updateInfo.latest_version || "");
      setHasBinaryUpdate(updateInfo.has_update);
      setWebvaultVersion(updateInfo.webvault_version || "");
      setWebvaultLatestVersion(updateInfo.webvault_latest || "");
      setHasWebvaultUpdate(updateInfo.webvault_has_update);

      await validateEnvironment();
    } catch (e) {
      console.error("Failed to check updates:", e);
      setError(String(e));
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const checkGuiUpdate = async () => {
    try {
      const version = await invoke<string>("get_gui_version");
      const updateInfo = await invoke<GuiUpdateInfo>("check_gui_updates", { currentVersion: version });
      setGuiUpdate(updateInfo);
      return updateInfo;
    } catch (e) {
      console.error("Failed to check GUI updates:", e);
      return null;
    }
  };

  const downloadGuiUpdate = async () => {
    const update = guiUpdate();
    if (!update || !update.download_url) {
      throw new Error("No update available");
    }
    setIsDownloadingGui(true);
    setDownloadGuiProgress(0);
    setError(null);
    try {
      await invoke("download_gui_installer", { 
        downloadUrl: update.download_url,
        version: update.latest_version
      });
    } catch (e) {
      console.error("Failed to download GUI update:", e);
      setError(String(e));
      throw e;
    } finally {
      setIsDownloadingGui(false);
      setDownloadGuiProgress(0);
    }
  };

  const installGuiUpdate = async () => {
    const update = guiUpdate();
    if (!update || !update.download_url) {
      throw new Error("No update available");
    }
    try {
      const version = update.latest_version;
      const filename = `Vaultwarden.Manager_${version}_x64-setup.exe`;
      const tempDir = await invoke<string>("get_temp_dir").catch(() => "");
      const installerPath = tempDir ? `${tempDir}\\${filename}` : `C:\\Users\\${await invoke<string>("get_username").catch(() => "User")}\\AppData\\Local\\Temp\\${filename}`;
      await invoke("install_gui_update", { installerPath });
    } catch (e) {
      console.error("Failed to install GUI update:", e);
      setError(String(e));
      throw e;
    }
  };

  const downloadBinary = async (version: string) => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadFile("vaultwarden.exe");
    setError(null);
    try {
      await invoke("download_binary", { version });
    } catch (e) {
      console.error("Failed to download binary:", e);
      setError(String(e));
      throw e;
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      setDownloadFile("");
    }
  };

  const downloadWebvault = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadFile("web-vault");
    setError(null);
    try {
      const version = await invoke<string>("download_webvault");
      setWebvaultVersion(version);
      await validateEnvironment();
    } catch (e) {
      console.error("Failed to download webvault:", e);
      setError(String(e));
      throw e;
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      setDownloadFile("");
    }
  };

  const getLocalIps = async () => {
    try {
      const ips = await invoke<NetworkInterface[]>("get_local_ips");
      setNetworkIps(ips);
      if (ips.length > 0 && !selectedIp()) {
        const ip = ips[0].ip;
        setSelectedIp(ip);
        updateDomainWithIp(ip);
      }
      return ips;
    } catch (e) {
      console.error("Failed to get local IPs:", e);
      throw e;
    }
  };

  const updateDomainWithIp = (ip: string) => {
    const cfg = config();
    setConfig({
      ...cfg,
      domain: `https://${ip}:${cfg.port}`,
    });
  };

  const generateCertificates = async () => {
    const status = certToolsStatus();
    const tool = certTool();

    if (tool === 'openssl' && (!status || !status.openssl_available)) {
      setError("OpenSSL is not installed. Please install OpenSSL to generate certificates.");
      return;
    }

    if (tool === 'mkcert' && (!status || !status.mkcert_available)) {
      setError("mkcert is not installed. Please install mkcert to generate certificates.");
      return;
    }

    setIsGeneratingCerts(true);
    setError(null);
    try {
      await invoke("generate_certificates_with_tool", {
        certPath: config().cert_path,
        keyPath: config().key_path,
        ip: selectedIp(),
        tool: tool,
      });
      await validateEnvironment();
    } catch (e) {
      console.error("Failed to generate certificates:", e);
      setError(String(e));
      throw e;
    } finally {
      setIsGeneratingCerts(false);
    }
  };

  const validateEnvironment = async () => {
    try {
      const result = await invoke<ValidationResult>("validate_environment", {
        config: config(),
      });
      setValidation(result);
      return result;
    } catch (e) {
      console.error("Failed to validate environment:", e);
      return null;
    }
  };

  const startVaultwarden = async () => {
    setError(null);
    try {
      const validationResult = await validateEnvironment();
      if (validationResult && !validationResult.is_ready) {
        const missing = validationResult.missing_items.join(", ");
        throw new Error(`Missing required files: ${missing}`);
      }
      await invoke("start_vaultwarden", { config: config() });
      setIsRunning(true);
    } catch (e) {
      console.error("Failed to start vaultwarden:", e);
      setError(String(e));
      throw e;
    }
  };

  const stopVaultwarden = async () => {
    try {
      await invoke("stop_vaultwarden");
      setIsRunning(false);
    } catch (e) {
      console.error("Failed to stop vaultwarden:", e);
      throw e;
    }
  };

  const getStatus = async () => {
    try {
      const status = await invoke<boolean>("get_status");
      setIsRunning(status);
      return status;
    } catch (e) {
      console.error("Failed to get status:", e);
      return false;
    }
  };

  const addLog = (level: string, message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const newEntry = { timestamp, level, message };
    setLogs((prev) => {
      if (prev.length >= 500) {
        return [...prev.slice(-499), newEntry];
      }
      return [...prev, newEntry];
    });
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const checkOpenssl = async () => {
    try {
      const available = await invoke<boolean>("check_openssl_available");
      setOpensslAvailable(available);
      return available;
    } catch (e) {
      console.error("Failed to check openssl:", e);
      setOpensslAvailable(false);
      return false;
    }
  };

  const checkCertTools = async () => {
    try {
      const status = await invoke<CertToolsStatus>("check_cert_tools_available");
      setCertToolsStatus(status);
      setOpensslAvailable(status.openssl_available);
      if (status.mkcert_available) {
        setCertTool('mkcert');
      } else if (status.openssl_available) {
        setCertTool('openssl');
      }
      return status;
    } catch (e) {
      console.error("Failed to check cert tools:", e);
      return null;
    }
  };

  const installMkcertCA = async () => {
    try {
      await invoke("install_mkcert_ca");
      await checkCertTools();
    } catch (e) {
      console.error("Failed to install mkcert CA:", e);
      setError(String(e));
      throw e;
    }
  };

  const defaultBackupConfig: BackupConfig = {
    enabled: false,
    min_diff_interval: 5,
    retention_count: 7,
    custom_dir: null,
  };

  const loadBackupConfig = async () => {
    try {
      const cfg = await invoke<BackupConfig>("get_backup_config");
      setBackupConfig(cfg);
    } catch (e) {
      console.error("Failed to load backup config:", e);
    }
  };

  const saveBackupConfig = async (cfg: BackupConfig) => {
    try {
      await invoke("save_backup_config", { config: cfg });
      setBackupConfig(cfg);
    } catch (e) {
      console.error("Failed to save backup config:", e);
      throw e;
    }
  };

  const listBackups = async () => {
    try {
      const backupList = await invoke<BackupInfo[]>("list_backups", { backupDir: backupConfig().custom_dir });
      setBackups(backupList);
      return backupList;
    } catch (e) {
      console.error("Failed to list backups:", e);
      return [];
    }
  };

  const checkDatabaseActivity = async () => {
    try {
      const status = await invoke<ActivityStatus>("check_database_activity");
      setActivityStatus(status);
      return status;
    } catch (e) {
      console.error("Failed to check activity:", e);
      return null;
    }
  };

  const checkSqlite3Installed = async () => {
    try {
      const installed = await invoke<boolean>("check_sqlite3_installed");
      setSqlite3Installed(installed);
      return installed;
    } catch (e) {
      console.error("Failed to check sqlite3:", e);
      return false;
    }
  };

  const downloadSqlite3 = async () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadFile("sqlite3");
    setError(null);
    try {
      await invoke<string>("download_sqlite3");
      setSqlite3Installed(true);
    } catch (e) {
      console.error("Failed to download sqlite3:", e);
      setError(String(e));
      throw e;
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      setDownloadFile("");
    }
  };

  const performBackup = async () => {
    setShowBackupWarning(false);
    setIsBackingUp(true);
    setError(null);
    try {
      if (!sqlite3Installed()) {
        const installed = await checkSqlite3Installed();
        if (!installed) {
          setNeedsSqlite3Download(true);
          setIsBackingUp(false);
          throw new Error("SQLITE3_NOT_INSTALLED");
        }
      }
      
      const activity = await checkDatabaseActivity();
      if (activity && activity.is_active) {
        setShowBackupWarning(true);
        setIsBackingUp(false);
        return;
      }
      
      await Promise.all([
        invoke("backup_database", { backupDir: backupConfig().custom_dir }),
        invoke("cleanup_old_backups", { 
          backupDir: backupConfig().custom_dir, 
          retentionCount: backupConfig().retention_count 
        }),
      ]);
      const [backups, lastTime] = await Promise.all([
        listBackups(),
        invoke<string | null>("get_last_backup_time", { backupDir: backupConfig().custom_dir }),
      ]);
      setLastBackup(lastTime);
    } catch (e) {
      console.error("Failed to perform backup:", e);
      setError(String(e));
      throw e;
    } finally {
      setIsBackingUp(false);
    }
  };

  const forceBackup = async () => {
    setShowBackupWarning(false);
    setIsBackingUp(true);
    setError(null);
    try {
      if (!sqlite3Installed()) {
        const installed = await checkSqlite3Installed();
        if (!installed) {
          setNeedsSqlite3Download(true);
          setIsBackingUp(false);
          throw new Error("SQLITE3_NOT_INSTALLED");
        }
      }
      await Promise.all([
        invoke("backup_database", { backupDir: backupConfig().custom_dir }),
        invoke("cleanup_old_backups", { 
          backupDir: backupConfig().custom_dir, 
          retentionCount: backupConfig().retention_count 
        }),
      ]);
      const [backups, lastTime] = await Promise.all([
        listBackups(),
        invoke<string | null>("get_last_backup_time", { backupDir: backupConfig().custom_dir }),
      ]);
      setLastBackup(lastTime);
    } catch (e) {
      console.error("Failed to perform backup:", e);
      setError(String(e));
      throw e;
    } finally {
      setIsBackingUp(false);
    }
  };

  const deleteBackup = async (path: string) => {
    try {
      await invoke("delete_backup", { backupPath: path });
      await listBackups();
    } catch (e) {
      console.error("Failed to delete backup:", e);
      setError(String(e));
      throw e;
    }
  };

  const restoreBackup = async (path: string) => {
    setError(null);
    try {
      if (isRunning()) {
        await stopVaultwarden();
      }
      await invoke("restore_backup", { backupPath: path });
      if (isRunning()) {
        await startVaultwarden();
      }
    } catch (e) {
      console.error("Failed to restore backup:", e);
      setError(String(e));
      throw e;
    }
  };

  const loadAutostartConfig = async () => {
    try {
      const enabled = await invoke<boolean>("get_autostart_enabled");
      setAutostartEnabled(enabled);
    } catch (e) {
      console.error("Failed to load autostart config:", e);
    }
  };

  const saveAutostartConfig = async (enabled: boolean) => {
    try {
      await invoke("set_autostart_enabled", { enabled });
      setAutostartEnabled(enabled);
    } catch (e) {
      console.error("Failed to set autostart:", e);
      throw e;
    }
  };

  const selectBackupDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "选择备份目录",
      });
      if (selected) {
        setBackupConfig((prev) => ({ ...prev, custom_dir: selected as string }));
        return selected as string;
      }
      return null;
    } catch (e) {
      console.error("Failed to select directory:", e);
      return null;
    }
  };

  const setupListeners = async () => {
    const unlistenPromises = [
      listen<boolean>("status-changed", (event) => {
        setIsRunning(event.payload);
      }),

      listen<CertToolsStatus>("cert-tools-status", (event) => {
        setCertToolsStatus(event.payload);
        setOpensslAvailable(event.payload.openssl_available);
        if (event.payload.mkcert_available) {
          setCertTool('mkcert');
        } else if (event.payload.openssl_available) {
          setCertTool('openssl');
        }
      }),

      listen<{
        binaryLatestVersion: string;
        webvaultLatestVersion: string;
        binaryVersion: string;
        webvaultVersion: string;
        validation: ValidationResult;
      }>("versions-checked", (event) => {
        const payload = event.payload;
        setBinaryLatestVersion(payload.binaryLatestVersion);
        setWebvaultLatestVersion(payload.webvaultLatestVersion);
        setBinaryVersion(payload.binaryVersion);
        setWebvaultVersion(payload.webvaultVersion);
        setValidation(payload.validation);
        setIsCheckingUpdate(false);
      }),

      listen<{ level: string; message: string }>("vaultwarden-log", (event) => {
        addLog(event.payload.level, event.payload.message);
      }),

      listen<VaultwardenConfig>("config-loaded", (event) => {
        setConfig(event.payload);
      }),

      listen<{ progress: number; downloaded: number; total: number; file: string }>(
        "download-progress",
        (event) => {
          setDownloadProgress(event.payload.progress);
          setDownloadFile(event.payload.file);
        }
      ),

      listen("download-complete", () => {
        setIsDownloading(false);
        setDownloadProgress(0);
        setDownloadFile("");
      }),

      listen("tray-start", async () => {
        if (!isRunning()) {
          try {
            await startVaultwarden();
          } catch (e) {
            console.error("Tray start failed:", e);
          }
        }
      }),

      listen("tray-check-update", async () => {
        setIsCheckingUpdate(true);
        const [latestBinary, latestWebvault] = await Promise.all([
          invoke<string>("get_latest_binary_version"),
          invoke<WebVaultVersion>("get_latest_webvault_version"),
        ]);
        setBinaryLatestVersion(latestBinary);
        setWebvaultLatestVersion(latestWebvault.version);
        setIsCheckingUpdate(false);
      }),

      listen("auto-start-vaultwarden", async () => {
        try {
          await startVaultwarden();
        } catch (e) {
          console.error("Auto start failed:", e);
        }
      }),
    ];

    const unlisteners = await Promise.all(unlistenPromises);

    return () => {
      unlisteners.forEach(fn => fn());
    };
  };

  let cleanupListeners: (() => void) | null = null;

  const initAndStart = async () => {
    if (cleanupListeners) {
      cleanupListeners();
    }
    cleanupListeners = await setupListeners();
    await Promise.all([
        loadConfig(),
        loadAutostartConfig(),
        loadBackupConfig(),
    ]);
  };

  return {
    isRunning,
    setIsRunning,
    binaryVersion,
    setBinaryVersion,
    binaryLatestVersion,
    setBinaryLatestVersion,
    hasBinaryUpdate,
    hasWebvaultUpdate,
    webvaultVersion,
    setWebvaultVersion,
    webvaultLatestVersion,
    setWebvaultLatestVersion,
    releases,
    setReleases,
    networkIps,
    setNetworkIps,
    selectedIp,
    setSelectedIp,
    config,
    setConfig,
    logs,
    setLogs,
    isCheckingUpdate,
    setIsCheckingUpdate,
    guiUpdate,
    setGuiUpdate,
    checkGuiUpdate,
    downloadGuiUpdate,
    installGuiUpdate,
    isDownloadingGui,
    downloadGuiProgress,
    isDownloading,
    setIsDownloading,
    downloadProgress,
    setDownloadProgress,
    downloadFile,
    validation,
    setValidation,
    opensslAvailable,
    setOpensslAvailable,
    certTool,
    setCertTool,
    certToolsStatus,
    setCertToolsStatus,
    checkCertTools,
    installMkcertCA,
    isGeneratingCerts,
    setIsGeneratingCerts,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    loadConfig,
    saveConfig,
    checkAllVersions,
    downloadBinary,
    downloadWebvault,
    getLocalIps,
    updateDomainWithIp,
    generateCertificates,
    validateEnvironment,
    startVaultwarden,
    stopVaultwarden,
    getStatus,
    addLog,
    clearLogs,
    setupListeners,
    initAndStart,
    backupConfig,
    setBackupConfig,
    backups,
    setBackups,
    lastBackup,
    setLastBackup,
    isBackingUp,
    setIsBackingUp,
    activityStatus,
    setActivityStatus,
    showBackupWarning,
    setShowBackupWarning,
    sqlite3Installed,
    needsSqlite3Download,
    setNeedsSqlite3Download,
    checkSqlite3Installed,
    downloadSqlite3,
    loadBackupConfig,
    saveBackupConfig,
    listBackups,
    checkDatabaseActivity,
    performBackup,
    forceBackup,
    deleteBackup,
    restoreBackup,
    selectBackupDirectory,
    autostartEnabled,
    loadAutostartConfig,
    saveAutostartConfig,
  };
}

export const appStore = createRoot(createAppStore);
