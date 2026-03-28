import { Component, Show, For, createEffect } from "solid-js";
import { useI18n } from "../i18n";
import { appStore } from "../stores/appStore";

export const LogViewer: Component = () => {
  const { t } = useI18n();
  const store = appStore;
  let logContainer: HTMLDivElement | undefined;

  createEffect(() => {
    const logs = store.logs();
    if (logContainer && logs.length > 0) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  });

  const handleSaveLogs = () => {
    const logText = store.logs()
      .map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`)
      .join("\n");

    const blob = new Blob([logText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vaultwarden-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="panel log-card">
      <div class="log-header">
        <div class="panel-title" style={{ margin: 0 }}>
          {t("logs.title")}
        </div>
        <div class="flex-center gap-sm">
          <button
            class="btn btn-secondary btn-small"
            onClick={handleSaveLogs}
            disabled={store.logs().length === 0}
          >
            💾 {t("logs.save")}
          </button>
          <button
            class="btn btn-secondary btn-small"
            onClick={() => store.clearLogs()}
            disabled={store.logs().length === 0}
          >
            🗑 {t("logs.clear")}
          </button>
        </div>
      </div>
      
      <Show
        when={store.logs().length > 0}
        fallback={
          <div class="log-viewer">
            <div class="log-entry">
              <span class="log-message text-muted">{t("logs.noLogs")}</span>
            </div>
          </div>
        }
      >
        <div class="log-viewer" ref={logContainer}>
          <For each={store.logs()}>
            {(entry) => (
              <div class="log-entry">
                <span class="log-timestamp">[{entry.timestamp}]</span>
                <span class={`log-level ${entry.level}`}>[{entry.level}]</span>
                <span class="log-message">{entry.message}</span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
