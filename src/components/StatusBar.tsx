import { Component, Show, createMemo } from "solid-js";
import { useI18n } from "../i18n";
import { appStore } from "../stores/appStore";
import { Settings, Globe, Shield, Check, X, Download, ArrowUp, AlertTriangle } from "lucide-solid";

export const StatusBar: Component = () => {
  const { t } = useI18n();
  const store = appStore;

  const certStatus = createMemo(() => {
    const status = store.certToolsStatus();
    const tool = store.certTool();
    const canGenerate = tool === 'openssl' 
      ? status?.openssl_available ?? false 
      : status?.mkcert_available ?? false;
    const mkcertText = !status ? "" 
      : !status.mkcert_available ? t("env.mkcertNotInstalled")
      : !status.mkcert_ca_installed ? t("env.mkcertCaNotInstalled")
      : t("env.mkcertCaInstalled");
    const isMkcertReady = status?.mkcert_available && status?.mkcert_ca_installed;
    return { canGenerate, mkcertText, isMkcertReady };
  });

  const handleDownloadBinary = async () => {
    if (store.binaryLatestVersion()) {
      try {
        await store.downloadBinary(store.binaryLatestVersion());
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

  const handleGenerateCerts = async () => {
    try {
      await store.generateCertificates();
    } catch (e) {
      console.error("Generate certs failed:", e);
    }
  };

  return (
    <div class="panel status-overview">
      <div class="panel-title">{t("status.title")}</div>

      <div class="status-grid">
        <div class="status-row">
          <div class="status-info">
            <div class="status-icon">
              <Settings size={18} />
            </div>
            <div>
              <div class="status-label">{t("status.vaultwarden")}</div>
              <div class="status-value">
                <Show when={store.binaryVersion()} fallback={<span class="text-muted">{t("status.notInstalled")}</span>}>
                  {store.binaryVersion()}
                </Show>
              </div>
            </div>
          </div>
          <Show when={store.binaryVersion()}>
            <Show when={store.hasBinaryUpdate()}>
              <span class="status-badge warning">
                <ArrowUp size={12} /> {t("status.updateAvailable")}
              </span>
            </Show>
            <Show when={!store.hasBinaryUpdate()}>
              <span class="status-badge success">
                <Check size={12} /> {t("versions.current")}
              </span>
            </Show>
          </Show>
          <Show when={!store.binaryVersion()}>
            <button
              class="btn btn-primary btn-small"
              onClick={handleDownloadBinary}
              disabled={store.isDownloading() || !store.binaryLatestVersion()}
            >
              <Show when={store.isDownloading() && store.downloadFile() === "vaultwarden.exe"} fallback={<><Download size={14} /> {t("versions.download")}</>}>
                <span class="spinner"></span>
                {store.downloadProgress()}%
              </Show>
            </button>
          </Show>
        </div>

        <div class="status-row">
          <div class="status-info">
            <div class="status-icon">
              <Globe size={18} />
            </div>
            <div>
              <div class="status-label">{t("status.webvault")}</div>
              <div class="status-value">
                <Show when={store.validation()?.webvault_exists} fallback={<span class="text-muted">{t("status.notInstalled")}</span>}>
                  {store.webvaultVersion() || t("versions.downloaded")}
                </Show>
              </div>
            </div>
          </div>
          <Show when={store.validation()?.webvault_exists}>
            <Show when={store.hasWebvaultUpdate()}>
              <span class="status-badge warning">
                <ArrowUp size={12} /> {t("status.updateAvailable")}
              </span>
            </Show>
            <Show when={!store.hasWebvaultUpdate()}>
              <span class="status-badge success">
                <Check size={12} /> {t("versions.current")}
              </span>
            </Show>
          </Show>
          <Show when={!store.validation()?.webvault_exists}>
            <button
              class="btn btn-primary btn-small"
              onClick={handleDownloadWebvault}
              disabled={store.isDownloading() && store.downloadFile() === "web-vault"}
            >
              <Show when={store.isDownloading() && store.downloadFile() === "web-vault"} fallback={<><Download size={14} /> {t("versions.download")}</>}>
                <span class="spinner"></span>
                {store.downloadProgress()}%
              </Show>
            </button>
          </Show>
        </div>

        <div class="status-row">
          <div class="status-info">
            <div class="status-icon">
              <Shield size={18} />
            </div>
            <div>
              <div class="status-label">{t("env.certificate")}</div>
              <div class="status-value">
                <Show when={store.validation()?.cert_exists} fallback={<span class="text-muted">{t("env.missing")}</span>}>
                  {store.config().cert_path}
                </Show>
              </div>
            </div>
          </div>
          <Show when={store.validation()?.cert_exists}>
            <span class="status-badge success"><Check size={12} /></span>
          </Show>
          <Show when={!store.validation()?.cert_exists && store.config().enable_tls}>
            <div class="cert-actions">
              <div class="cert-tool-selector">
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
                    <span class="status-warning"><AlertTriangle size={14} /> {certStatus().mkcertText}</span>
                    <button
                      class="btn btn-primary btn-small"
                      onClick={() => store.installMkcertCA()}
                    >
                      {t("env.installMkcertCa")}
                    </button>
                  </div>
                </Show>

                <Show when={certStatus().isMkcertReady}>
                  <div class="mkcert-ca-status ready">
                    <Check size={14} /> {certStatus().mkcertText}
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
                onClick={handleGenerateCerts}
                disabled={store.isGeneratingCerts() || !certStatus().canGenerate}
              >
                <Show when={store.isGeneratingCerts()} fallback={<><Shield size={14} /> {t("env.generateCerts")}</>}>
                  <span class="spinner"></span>
                </Show>
              </button>
            </div>
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
