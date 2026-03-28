import { Component, Show, For } from "solid-js";
import { useI18n } from "../i18n";
import { appStore } from "../stores/appStore";

interface ServiceControlProps {
  onStart: () => void;
  onStop: () => void;
}

export const ServiceControl: Component<ServiceControlProps> = (props) => {
  const { t } = useI18n();
  const store = appStore;

  return (
    <div class="panel service-control">
      <div class="panel-title">{store.isRunning() ? t("status.running") : t("status.stopped")}</div>
      
      <div class="service-status">
        <div class={`status-indicator-large ${store.isRunning() ? "running" : "stopped"}`}>
          <span>{store.isRunning() ? "✓" : "✗"}</span>
        </div>
        
        <div class="status-text-large">
          {store.isRunning() ? t("status.running") : t("status.stopped")}
        </div>

        <div class="ip-display">
          <span>🌐</span>
          <select
            value={store.selectedIp()}
            onChange={(e) => store.setSelectedIp(e.currentTarget.value)}
          >
            <For each={store.networkIps()}>
              {(iface) => (
                <option value={iface.ip}>
                  {iface.ip} ({iface.type})
                </option>
              )}
            </For>
          </select>
          <button
            class="btn btn-icon btn-secondary"
            onClick={() => store.getLocalIps()}
            title={t("status.refreshIp")}
          >
            ↻
          </button>
        </div>
      </div>

      <Show
        when={!store.isRunning()}
        fallback={
          <button class="btn btn-danger btn-start" onClick={props.onStop}>
            ⏹ {t("actions.stop")}
          </button>
        }
      >
        <button
          class="btn btn-success btn-start"
          onClick={props.onStart}
          disabled={store.validation()?.is_ready === false}
        >
          🚀 {t("actions.start")}
        </button>
      </Show>
    </div>
  );
};
