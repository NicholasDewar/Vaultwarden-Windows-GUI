import { Component, Show, createSignal, onCleanup } from "solid-js";
import { useI18n } from "../i18n";
import { appStore, VaultwardenConfig } from "../stores/appStore";

interface ConfigPanelProps {
  onIpChange: (ip: string) => void;
  onPortChange: (port: string) => void;
}

export const ConfigPanel: Component<ConfigPanelProps> = (props) => {
  const { t } = useI18n();
  const store = appStore;

  const [debouncedAddress, setDebouncedAddress] = createSignal(store.config().address);
  const [debouncedCertPath, setDebouncedCertPath] = createSignal(store.config().cert_path);
  const [debouncedKeyPath, setDebouncedKeyPath] = createSignal(store.config().key_path);
  const [debouncedDataFolder, setDebouncedDataFolder] = createSignal(store.config().data_folder);

  let addressTimeout: number | undefined;
  let certPathTimeout: number | undefined;
  let keyPathTimeout: number | undefined;
  let dataFolderTimeout: number | undefined;

  onCleanup(() => {
    if (addressTimeout) clearTimeout(addressTimeout);
    if (certPathTimeout) clearTimeout(certPathTimeout);
    if (keyPathTimeout) clearTimeout(keyPathTimeout);
    if (dataFolderTimeout) clearTimeout(dataFolderTimeout);
  });

  const handleInputChange = (field: keyof VaultwardenConfig, value: any) => {
    store.setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const debouncedAddressChange = (value: string) => {
    setDebouncedAddress(value);
    if (addressTimeout) clearTimeout(addressTimeout);
    addressTimeout = setTimeout(() => {
      handleInputChange("address", value);
    }, 300) as unknown as number;
  };

  const debouncedCertPathChange = (value: string) => {
    setDebouncedCertPath(value);
    if (certPathTimeout) clearTimeout(certPathTimeout);
    certPathTimeout = setTimeout(() => {
      handleInputChange("cert_path", value);
    }, 300) as unknown as number;
  };

  const debouncedKeyPathChange = (value: string) => {
    setDebouncedKeyPath(value);
    if (keyPathTimeout) clearTimeout(keyPathTimeout);
    keyPathTimeout = setTimeout(() => {
      handleInputChange("key_path", value);
    }, 300) as unknown as number;
  };

  const debouncedDataFolderChange = (value: string) => {
    setDebouncedDataFolder(value);
    if (dataFolderTimeout) clearTimeout(dataFolderTimeout);
    dataFolderTimeout = setTimeout(() => {
      handleInputChange("data_folder", value);
    }, 300) as unknown as number;
  };

  const handleSave = async () => {
    try {
      await store.saveConfig(store.config());
      await store.validateEnvironment();
    } catch (e) {
      console.error("Save failed:", e);
    }
  };

  return (
    <div class="panel config-card">
      <div class="panel-title">{t("config.title")}</div>
      
      <div class="config-form">
        <div class="form-section-title">{t("config.connection")}</div>
        
        <div class="form-group">
          <label class="form-label">{t("config.address")}</label>
          <input
            type="text"
            class="form-input"
            value={debouncedAddress()}
            onInput={(e) => debouncedAddressChange(e.currentTarget.value)}
          />
        </div>
        
        <div class="form-group">
          <label class="form-label">{t("config.port")}</label>
          <input
            type="number"
            class="form-input"
            value={store.config().port}
            onInput={(e) => props.onPortChange(e.currentTarget.value)}
          />
        </div>
        
        <div class="form-section-title">{t("config.tlsSettings")}</div>
        
        <div class="form-group full-width">
          <div class="toggle-wrapper">
            <span class="toggle-label">{t("config.enableTls")}</span>
            <button
              class={`toggle-switch ${store.config().enable_tls ? "active" : ""}`}
              onClick={() => handleInputChange("enable_tls", !store.config().enable_tls)}
              role="switch"
              aria-checked={store.config().enable_tls}
            >
              <span class="toggle-slider" />
            </button>
          </div>
        </div>
        
        <Show when={store.config().enable_tls}>
          <div class="form-group">
            <label class="form-label">{t("config.certPath")}</label>
            <input
              type="text"
              class="form-input"
              value={debouncedCertPath()}
              onInput={(e) => debouncedCertPathChange(e.currentTarget.value)}
            />
          </div>
          <div class="form-group">
            <label class="form-label">{t("config.keyPath")}</label>
            <input
              type="text"
              class="form-input"
              value={debouncedKeyPath()}
              onInput={(e) => debouncedKeyPathChange(e.currentTarget.value)}
            />
          </div>
        </Show>
        
        <div class="form-section-title">{t("config.dataStorage")}</div>
        
        <div class="form-group full-width">
          <label class="form-label">{t("config.dataFolder")}</label>
          <input
            type="text"
            class="form-input"
            value={debouncedDataFolder()}
            onInput={(e) => debouncedDataFolderChange(e.currentTarget.value)}
          />
        </div>
        
        <div class="form-section-title">{t("config.autostart")}</div>
        
        <div class="form-group full-width">
          <div class="toggle-wrapper">
            <div class="toggle-info">
              <span class="toggle-label">{t("config.autostartEnable")}</span>
              <span class="toggle-description">{t("config.autostartDescription")}</span>
            </div>
            <button
              class={`toggle-switch ${store.autostartEnabled() ? "active" : ""}`}
              onClick={() => store.saveAutostartConfig(!store.autostartEnabled())}
              role="switch"
              aria-checked={store.autostartEnabled()}
            >
              <span class="toggle-slider" />
            </button>
          </div>
        </div>
        
        <div class="form-group" style={{ "align-self": "end" }}>
          <button class="btn btn-primary" onClick={handleSave}>
            {t("config.save")}
          </button>
        </div>
      </div>
    </div>
  );
};
