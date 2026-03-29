import { Component, Show } from "solid-js";
import { useI18n } from "../i18n";
import { appStore } from "../stores/appStore";
import { Settings, Globe, Shield, Check, X, AlertTriangle, Download, ArrowUp } from "lucide-solid";

interface EnvironmentPanelProps {
  onDownloadBinary: () => void;
  onDownloadWebvault: () => void;
  onGenerateCerts: () => void;
}

export const EnvironmentPanel: Component<EnvironmentPanelProps> = (props) => {
  const { t } = useI18n();
  const store = appStore;

  const canGenerateCerts = () => {
    const status = store.certToolsStatus();
    const tool = store.certTool();
    if (tool === 'openssl') return status?.openssl_available ?? false;
    if (tool === 'mkcert') return status?.mkcert_available ?? false;
    return false;
  };

  const getMkcertStatusText = () => {
    const status = store.certToolsStatus();
    if (!status) return "";
    if (!status.mkcert_available) return t("env.mkcertNotInstalled");
    if (!status.mkcert_ca_installed) return t("env.mkcertCaNotInstalled");
    return t("env.mkcertCaInstalled");
  };

  const isMkcertReady = () => {
    const status = store.certToolsStatus();
    return status?.mkcert_available && status?.mkcert_ca_installed;
  };

  return (
    <div class="panel environment-card">
      <div class="panel-title">{t("env.title")}</div>
      
      <div class="env-grid">
        <div class={`env-item ${store.validation()?.binary_exists ? "ready" : ""}`}>
          <div class="env-icon"><Settings size={20} /></div>
          <div class="env-name">{t("env.binary")}</div>
          <div class={`env-status ${store.validation()?.binary_exists ? "ready" : ""}`}>
            <Show when={store.validation()?.binary_exists} fallback={t("env.missing")}>
              <Check size={14} /> {store.binaryVersion() || t("versions.downloaded")}
            </Show>
          </div>
          <Show when={!store.validation()?.binary_exists}>
            <button
              class="btn btn-primary btn-small"
              onClick={props.onDownloadBinary}
              disabled={store.isDownloading() || !store.binaryLatestVersion()}
            >
              <Show when={store.isDownloading() && store.downloadFile() === "vaultwarden.exe"} fallback={t("versions.download")}>
                <span class="spinner"></span>
                {store.downloadProgress()}%
              </Show>
            </button>
          </Show>
          <Show when={store.validation()?.binary_exists && store.hasBinaryUpdate()}>
            <span class="status-badge warning"><ArrowUp size={12} /> {t("status.updateAvailable")}</span>
          </Show>
        </div>

        <div class={`env-item ${store.validation()?.webvault_exists ? "ready" : ""}`}>
          <div class="env-icon"><Globe size={20} /></div>
          <div class="env-name">{t("env.webvault")}</div>
          <div class={`env-status ${store.validation()?.webvault_exists ? "ready" : ""}`}>
            <Show when={store.validation()?.webvault_exists} fallback={t("env.missing")}>
              <Check size={14} /> {store.webvaultVersion() || t("versions.downloaded")}
            </Show>
          </div>
          <Show when={!store.validation()?.webvault_exists}>
            <button
              class="btn btn-primary btn-small"
              onClick={props.onDownloadWebvault}
              disabled={store.isDownloading() && store.downloadFile() === "web-vault"}
            >
              <Show when={store.isDownloading() && store.downloadFile() === "web-vault"} fallback={t("versions.download")}>
                <span class="spinner"></span>
                {store.downloadProgress()}%
              </Show>
            </button>
          </Show>
        </div>

        <div class={`env-item ${store.validation()?.cert_exists ? "ready" : ""}`}>
          <div class="env-icon"><Shield size={20} /></div>
          <div class="env-name">{t("env.certificate")}</div>
          <div class={`env-status ${store.validation()?.cert_exists ? "ready" : ""}`}>
            <Show when={store.validation()?.cert_exists} fallback={t("env.missing")}>
              <Check size={14} /> {t("env.ready")}
            </Show>
          </div>
          
          <Show when={!store.validation()?.cert_exists}>
            <div class="cert-tool-selector">
              <label class="cert-tool-label">{t("env.certTool")}:</label>
              <select
                class="cert-tool-select"
                value={store.certTool()}
                onChange={(e) => store.setCertTool(e.target.value as 'openssl' | 'mkcert')}
              >
                <option value="mkcert">{t("env.mkcert")}</option>
                <option value="openssl">{t("env.openssl")}</option>
              </select>
            </div>

            <Show when={store.certTool() === 'mkcert'}>
              <Show when={store.certToolsStatus()?.mkcert_available === false}>
                <div class="mkcert-install-guide">
                  <p class="mkcert-guide-title">{t("env.mkcertInstallGuide")}:</p>
                  <div class="install-commands">
                    <p><strong>{t("env.scoop")}:</strong> <code>scoop install mkcert</code></p>
                    <p><strong>{t("env.choco")}:</strong> <code>choco install mkcert -y</code></p>
                  </div>
                  <button
                    class="btn btn-secondary btn-small"
                    onClick={() => store.checkCertTools()}
                  >
                    {t("env.iHaveInstalled")}
                  </button>
                </div>
              </Show>

              <Show when={store.certToolsStatus()?.mkcert_available && !store.certToolsStatus()?.mkcert_ca_installed}>
                <div class="mkcert-ca-status">
                  <span class="status-warning"><AlertTriangle size={14} /> {getMkcertStatusText()}</span>
                  <button
                    class="btn btn-primary btn-small"
                    onClick={() => store.installMkcertCA()}
                  >
                    {t("env.installMkcertCa")}
                  </button>
                </div>
              </Show>

              <Show when={isMkcertReady()}>
                <div class="mkcert-ca-status ready">
                  <Check size={14} /> {getMkcertStatusText()}
                </div>
              </Show>
            </Show>

            <Show when={store.certTool() === 'openssl' && !store.opensslAvailable()}>
              <div class="openssl-install-guide">
                <p class="openssl-guide-title">{t("env.opensslInstallGuide")}:</p>
                <div class="install-commands">
                  <p><strong>{t("env.scoop")}:</strong> <code>scoop install openssl</code></p>
                  <p><strong>{t("env.choco")}:</strong> <code>choco install openssl -y</code></p>
                </div>
                <button
                  class="btn btn-secondary btn-small"
                  onClick={() => store.checkCertTools()}
                >
                  {t("env.iHaveInstalled")}
                </button>
              </div>
            </Show>

            <button
              class="btn btn-primary btn-small"
              onClick={props.onGenerateCerts}
              disabled={store.isGeneratingCerts() || !canGenerateCerts()}
            >
              <Show when={store.isGeneratingCerts()} fallback={t("env.generateCerts")}>
                <span class="spinner"></span>
              </Show>
            </button>
          </Show>
        </div>
      </div>

      <Show when={store.isDownloading()}>
        <div class="progress-container">
          <div class="progress-bar" style={{ width: `${store.downloadProgress()}%` }} />
        </div>
      </Show>
    </div>
  );
};
