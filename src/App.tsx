import { Component, onMount, Show, createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { WebVaultVersion } from "./stores/appStore";
import { I18nProvider, useI18n } from "./i18n";
import { appStore } from "./stores/appStore";
import { ConfigPanel } from "./components/ConfigPanel";
import { LogViewer } from "./components/LogViewer";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { StatusBar } from "./components/StatusBar";
import { ServiceControl } from "./components/ServiceControl";
import { BackupSettings } from "./components/BackupSettings";
import { BackupPanel } from "./components/BackupPanel";
import { Settings, Database, RefreshCw } from "lucide-solid";
import "./styles/global.css";

type TabType = "main" | "backup";

const AppContent: Component = () => {
  const store = appStore;
  const { t } = useI18n();
  const [activeTab, setActiveTab] = createSignal<TabType>("main");

  onMount(async () => {
    await store.initAndStart();
  });

  const handleStart = async () => {
    try {
      await store.startVaultwarden();
    } catch (e) {
      console.error("Start failed:", e);
    }
  };

  const handleStop = async () => {
    try {
      await store.stopVaultwarden();
    } catch (e) {
      console.error("Stop failed:", e);
    }
  };

  const handleCheckUpdate = async () => {
    try {
      store.setIsCheckingUpdate(true);
      const [latestBinary, latestWebvault] = await Promise.all([
        invoke<string>("get_latest_binary_version"),
        invoke<WebVaultVersion>("get_latest_webvault_version"),
      ]);
      store.setBinaryLatestVersion(latestBinary);
      store.setWebvaultLatestVersion(latestWebvault.version);
    } catch (e) {
      console.error("Check update failed:", e);
    } finally {
      store.setIsCheckingUpdate(false);
    }
  };

  const handleIpChange = (ip: string) => {
    store.setSelectedIp(ip);
    store.updateDomainWithIp(ip);
  };

  const handlePortChange = (port: string) => {
    const portNum = parseInt(port) || 8443;
    store.setConfig((prev) => ({
      ...prev,
      port: portNum,
    }));
    store.updateDomainWithIp(store.selectedIp());
  };

  return (
    <div class="app">
      <header class="header">
          <div class="header-left">
          <span class="app-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Vaultwarden Manager
          </span>
        </div>
        <div class="header-tabs">
          <button
            class={`tab-btn ${activeTab() === "main" ? "active" : ""}`}
            onClick={() => setActiveTab("main")}
          >
            <Settings size={16} /> {t("tabs.main")}
          </button>
          <button
            class={`tab-btn ${activeTab() === "backup" ? "active" : ""}`}
            onClick={() => setActiveTab("backup")}
          >
            <Database size={16} /> {t("tabs.backup")}
          </button>
        </div>
        <div class="header-right">
          <ThemeSwitcher />
          <LanguageSwitcher />
          <button
            class="btn btn-secondary"
            onClick={handleCheckUpdate}
            disabled={store.isCheckingUpdate()}
          >
            <Show when={store.isCheckingUpdate()} fallback={<><RefreshCw size={16} /> {t("status.checkUpdate")}</>}>
              <span class="spinner"></span>
              {t("app.checking")}
            </Show>
          </button>
        </div>
      </header>

      <main class="main-content">
        <Show when={activeTab() === "main"}>
          <Show when={store.error()}>
            <div class="error-banner">
              {store.error()}
            </div>
          </Show>

          <StatusBar />
          <ServiceControl onStart={handleStart} onStop={handleStop} />
          <ConfigPanel
            onIpChange={handleIpChange}
            onPortChange={handlePortChange}
          />
          <LogViewer />
        </Show>

        <Show when={activeTab() === "backup"}>
          <BackupSettings />
          <BackupPanel />
        </Show>
      </main>
    </div>
  );
};

const App: Component = () => {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
};

export default App;
