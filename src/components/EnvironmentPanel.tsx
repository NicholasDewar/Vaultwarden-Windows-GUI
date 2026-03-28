import { Component, Show } from "solid-js";
import { useI18n } from "../i18n";
import { appStore } from "../stores/appStore";

interface EnvironmentPanelProps {
  onDownloadBinary: () => void;
  onDownloadWebvault: () => void;
  onGenerateCerts: () => void;
}

export const EnvironmentPanel: Component<EnvironmentPanelProps> = (props) => {
  const { t } = useI18n();
  const store = appStore;

  return (
    <div class="panel environment-card">
      <div class="panel-title">{t("env.title")}</div>
      
      <div class="env-grid">
        <div class={`env-item ${store.validation()?.binary_exists ? "ready" : ""}`}>
          <div class="env-icon">⚙️</div>
          <div class="env-name">{t("env.binary")}</div>
          <div class={`env-status ${store.validation()?.binary_exists ? "ready" : ""}`}>
            <Show when={store.validation()?.binary_exists} fallback={t("env.missing")}>
              ✓ {store.binaryVersion() || t("versions.downloaded")}
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
          <Show when={store.validation()?.binary_exists && store.binaryVersion() !== store.binaryLatestVersion()}>
            <span class="status-badge warning">↑ {t("status.updateAvailable")}</span>
          </Show>
        </div>

        <div class={`env-item ${store.validation()?.webvault_exists ? "ready" : ""}`}>
          <div class="env-icon">🌐</div>
          <div class="env-name">{t("env.webvault")}</div>
          <div class={`env-status ${store.validation()?.webvault_exists ? "ready" : ""}`}>
            <Show when={store.validation()?.webvault_exists} fallback={t("env.missing")}>
              ✓ {store.webvaultVersion() || t("versions.downloaded")}
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
          <div class="env-icon">🔒</div>
          <div class="env-name">{t("env.certificate")}</div>
          <div class={`env-status ${store.validation()?.cert_exists ? "ready" : ""}`}>
            <Show when={store.validation()?.cert_exists} fallback={t("env.missing")}>
              ✓ {t("env.ready")}
            </Show>
          </div>
          <Show when={!store.validation()?.cert_exists}>
            <button
              class="btn btn-primary btn-small"
              onClick={props.onGenerateCerts}
              disabled={store.isGeneratingCerts() || !store.opensslAvailable()}
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

      <Show when={!store.opensslAvailable()}>
        <div class="env-warning" style={{ "margin-top": "12px" }}>
          ⚠️ {t("env.opensslNotFound")}
        </div>
      </Show>
    </div>
  );
};
