import { Component, Show, For, createSignal } from "solid-js";
import { useI18n } from "../i18n";
import { appStore } from "../stores/appStore";
import { Globe, Check, X, Play, Square, RefreshCw } from "lucide-solid";

interface ServiceControlProps {
  onStart: () => void;
  onStop: () => void;
}

export const ServiceControl: Component<ServiceControlProps> = (props) => {
  const { t } = useI18n();
  const store = appStore;
  const [ipDropdownOpen, setIpDropdownOpen] = createSignal(false);

  const handleIpSelect = async (ip: string) => {
    store.setSelectedIp(ip);
    store.updateDomainWithIp(ip);
    try {
      await store.saveConfig(store.config());
      store.setSuccessMessage(t("config.saved"));
      setTimeout(() => store.setSuccessMessage(null), 2000);
    } catch (e) {
      console.error("Auto-save failed:", e);
    }
    setIpDropdownOpen(false);
  };

  return (
    <div class="panel service-control">
      <div class="panel-title">{store.isRunning() ? t("status.running") : t("status.stopped")}</div>
      
      <div class="service-status">
        <div class={`status-indicator-large ${store.isRunning() ? "running" : "stopped"}`}>
          <span>{store.isRunning() ? <Check size={24} /> : <X size={24} />}</span>
        </div>
        
        <div class="status-text-large">
          {store.isRunning() ? t("status.running") : t("status.stopped")}
        </div>

        <div class="ip-selector">
          <Show when={ipDropdownOpen()}>
            <div class="ip-backdrop" onClick={() => setIpDropdownOpen(false)} />
          </Show>
          
          <button
            class="ip-trigger"
            onClick={() => setIpDropdownOpen(!ipDropdownOpen())}
            aria-expanded={ipDropdownOpen()}
          >
            <span class="ip-icon"><Globe size={16} /></span>
            <span class="ip-value">{store.selectedIp() || t("status.unknown")}</span>
            <span class={`ip-arrow ${ipDropdownOpen() ? "open" : ""}`}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
          </button>

          <Show when={ipDropdownOpen()}>
            <div class="ip-menu">
              <div class="ip-menu-header">
                <span>{t("status.ip")}</span>
              </div>
              <div class="ip-list">
                <For each={store.networkIps()}>
                  {(iface) => (
                    <button
                      class={`ip-option ${store.selectedIp() === iface.ip ? "active" : ""}`}
                      onClick={() => handleIpSelect(iface.ip)}
                    >
                      <div class="ip-option-main">
                        <span class="ip-address">{iface.ip}</span>
                        <span class="ip-type">{iface.type}</span>
                      </div>
                      <Show when={store.selectedIp() === iface.ip}>
                        <span class="ip-check">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                        </span>
                      </Show>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <button
            class="btn btn-icon btn-secondary ip-refresh"
            onClick={() => store.getLocalIps()}
            title={t("status.refreshIp")}
          >
            <RefreshCw size={16} />
          </button>
        </div>

        <Show when={store.successMessage()}>
          <div class="toast toast-success">{store.successMessage()}</div>
        </Show>
      </div>

      <Show
        when={!store.isRunning()}
        fallback={
          <button class="btn btn-danger btn-start" onClick={props.onStop}>
            <Square size={16} /> {t("actions.stop")}
          </button>
        }
      >
        <button
          class="btn btn-success btn-start"
          onClick={props.onStart}
          disabled={store.validation()?.is_ready === false}
        >
          <Play size={16} /> {t("actions.start")}
        </button>
      </Show>
    </div>
  );
};
