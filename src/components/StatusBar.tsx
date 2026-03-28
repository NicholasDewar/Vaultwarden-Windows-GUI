import { Component, Show, For } from "solid-js";
import { useI18n } from "../i18n";
import { appStore } from "../stores/appStore";

export const StatusBar: Component = () => {
  const { t } = useI18n();
  const store = appStore;

  return (
    <div class="panel status-overview">
      <div class="panel-title">{t("status.title")}</div>
      
      <div class="status-grid">
        <div class="status-row">
          <div class="status-info">
            <div class="status-icon">⚙️</div>
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
            <span class="status-badge success">
              ✓ {t("versions.current")}
            </span>
          </Show>
          <Show when={!store.binaryVersion()}>
            <span class="status-badge warning">
              ✗ {t("status.notInstalled")}
            </span>
          </Show>
        </div>

        <div class="status-row">
          <div class="status-info">
            <div class="status-icon">🌐</div>
            <div>
              <div class="status-label">{t("status.webvault")}</div>
              <div class="status-value">
                <Show when={store.webvaultVersion()} fallback={<span class="text-muted">{t("status.notInstalled")}</span>}>
                  {store.webvaultVersion()}
                </Show>
              </div>
            </div>
          </div>
          <Show when={store.webvaultVersion()}>
            <span class="status-badge success">
              ✓ {t("versions.current")}
            </span>
          </Show>
          <Show when={!store.webvaultVersion()}>
            <span class="status-badge warning">
              ✗ {t("status.notInstalled")}
            </span>
          </Show>
        </div>

        <div class="status-row">
          <div class="status-info">
            <div class="status-icon">🔒</div>
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
            <span class="status-badge success">✓</span>
          </Show>
          <Show when={!store.validation()?.cert_exists && store.config().enable_tls}>
            <span class="status-badge warning">✗</span>
          </Show>
        </div>
      </div>
    </div>
  );
};
