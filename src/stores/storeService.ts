import { load, Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";

const STORE_PATH = "config.json";

let storeInstance: Store | null = null;

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await load(STORE_PATH);
  }
  return storeInstance;
}

export const storeService = {
  async get<T>(key: string): Promise<T | null> {
    const store = await getStore();
    return (store.get(key) as T | null) ?? null;
  },

  async set<T>(key: string, value: T): Promise<void> {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
  },

  async getConfig(): Promise<VaultwardenConfig | null> {
    return this.get<VaultwardenConfig>("config");
  },

  async setConfig(config: VaultwardenConfig): Promise<void> {
    await this.set("config", config);
  },

  async getLanguage(): Promise<string | null> {
    return this.get<string>("language");
  },

  async setLanguage(lang: string): Promise<void> {
    await this.set("language", lang);
  },

  async getBackupConfig(): Promise<BackupConfig | null> {
    return this.get<BackupConfig>("backupConfig");
  },

  async setBackupConfig(config: BackupConfig): Promise<void> {
    await this.set("backupConfig", config);
    try {
      await invoke("save_backup_config", { config });
    } catch (e) {
      console.error("Failed to sync backup config to file:", e);
    }
  },
};

export interface VaultwardenConfig {
  address: string;
  port: number;
  domain: string;
  enable_tls: boolean;
  cert_path: string;
  key_path: string;
  data_folder: string;
}

export interface BackupConfig {
  enabled: boolean;
  interval_minutes: number;
  retention_count: number;
  custom_dir: string | null;
  require_idle: boolean;
}
