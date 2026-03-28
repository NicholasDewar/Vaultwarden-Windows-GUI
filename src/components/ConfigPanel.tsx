import { Component, Show } from "solid-js";
import { useI18n } from "../i18n";
import { appStore, VaultwardenConfig } from "../stores/appStore";

interface ConfigPanelProps {
  onIpChange: (ip: string) => void;
  onPortChange: (port: string) => void;
}

export const ConfigPanel: Component<ConfigPanelProps> = (props) => {
  const { t } = useI18n();
  const store = appStore;

  const handleInputChange = (field: keyof VaultwardenConfig, value: any) => {
    store.setConfig((prev) => ({ ...prev, [field]: value }));
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
        <div class="form-group">
          <label class="form-label">{t("config.address")}</label>
          <input
            type="text"
            class="form-input"
            value={store.config().address}
            onInput={(e) => handleInputChange("address", e.currentTarget.value)}
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
        
        <div class="form-group full-width">
          <label class="form-label">{t("config.domain")}</label>
          <input
            type="text"
            class="form-input"
            value={store.config().domain}
            onInput={(e) => handleInputChange("domain", e.currentTarget.value)}
            placeholder="https://192.168.1.100:8443"
          />
        </div>
        
        <div class="form-group full-width">
          <div class="form-checkbox-wrapper">
            <input
              type="checkbox"
              class="form-checkbox"
              checked={store.config().enable_tls}
              onChange={(e) => handleInputChange("enable_tls", e.currentTarget.checked)}
            />
            <span>{t("config.enableTls")}</span>
          </div>
        </div>
        
        <Show when={store.config().enable_tls}>
          <div class="form-group">
            <label class="form-label">{t("config.certPath")}</label>
            <input
              type="text"
              class="form-input"
              value={store.config().cert_path}
              onInput={(e) => handleInputChange("cert_path", e.currentTarget.value)}
            />
          </div>
          <div class="form-group">
            <label class="form-label">{t("config.keyPath")}</label>
            <input
              type="text"
              class="form-input"
              value={store.config().key_path}
              onInput={(e) => handleInputChange("key_path", e.currentTarget.value)}
            />
          </div>
        </Show>
        
        <div class="form-group">
          <label class="form-label">{t("config.dataFolder")}</label>
          <input
            type="text"
            class="form-input"
            value={store.config().data_folder}
            onInput={(e) => handleInputChange("data_folder", e.currentTarget.value)}
          />
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
