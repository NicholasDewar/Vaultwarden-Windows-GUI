import { Component, onMount, Show, createSignal } from "solid-js";
import { I18nProvider } from "./i18n";
import { appStore } from "./stores/appStore";
import { ConfigPanel } from "./components/ConfigPanel";
import { LogViewer } from "./components/LogViewer";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { StatusBar } from "./components/StatusBar";
import { EnvironmentPanel } from "./components/EnvironmentPanel";
import { ServiceControl } from "./components/ServiceControl";
import { BackupSettings } from "./components/BackupSettings";
import { BackupPanel } from "./components/BackupPanel";
import "./styles/global.css";

type TabType = "main" | "backup";

const AppContent: Component = () => {
  const store = appStore;
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
      await store.checkAllVersions();
    } catch (e) {
      console.error("Check update failed:", e);
    }
  };

  const handleGenerateCerts = async () => {
    try {
      await store.generateCertificates();
    } catch (e) {
      console.error("Generate certs failed:", e);
    }
  };

  const handleDownloadBinary = async () => {
    if (store.binaryLatestVersion()) {
      try {
        await store.downloadBinary(store.binaryLatestVersion());
        await store.checkBinaryVersion();
        await store.validateEnvironment();
      } catch (e) {
        console.error("Download binary failed:", e);
      }
    }
  };

  const handleDownloadWebvault = async () => {
    try {
      await store.downloadWebvault();
    } catch (e) {
      console.error("Download webvault failed:", e);
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
          <span class="app-title">🔐 Vaultwarden Manager</span>
        </div>
        <div class="header-tabs">
          <button
            class={`tab-btn ${activeTab() === "main" ? "active" : ""}`}
            onClick={() => setActiveTab("main")}
          >
            ⚙️ 主页面
          </button>
          <button
            class={`tab-btn ${activeTab() === "backup" ? "active" : ""}`}
            onClick={() => setActiveTab("backup")}
          >
            💾 备份
          </button>
        </div>
        <div class="header-right">
          <LanguageSwitcher />
          <button
            class="btn btn-secondary"
            onClick={handleCheckUpdate}
            disabled={store.isCheckingUpdate()}
          >
            <Show when={store.isCheckingUpdate()} fallback="↻ 检查更新">
              <span class="spinner"></span>
              检查中...
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
          <EnvironmentPanel
            onDownloadBinary={handleDownloadBinary}
            onDownloadWebvault={handleDownloadWebvault}
            onGenerateCerts={handleGenerateCerts}
          />
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
