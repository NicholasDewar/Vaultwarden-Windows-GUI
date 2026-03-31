import { Component, Show, For, createSignal } from "solid-js";
import { useI18n } from "../i18n";
import { appStore } from "../stores/appStore";
import { save, open } from "@tauri-apps/plugin-dialog";

export const BackupPanel: Component = () => {
  const { t } = useI18n();
  const store = appStore;
  const [showSqlite3Dialog, setShowSqlite3Dialog] = createSignal(false);

  const handleBackupNow = async () => {
    await store.checkSqlite3Installed();
    if (!store.sqlite3Installed()) {
      setShowSqlite3Dialog(true);
      return;
    }
    await store.checkDatabaseActivity();
    await store.performBackup();
  };

  const handleForceBackup = async () => {
    await store.checkSqlite3Installed();
    if (!store.sqlite3Installed()) {
      setShowSqlite3Dialog(true);
      return;
    }
    await store.forceBackup();
  };

  const handleDownloadSqlite3 = async () => {
    setShowSqlite3Dialog(false);
    try {
      await store.downloadSqlite3();
      await store.performBackup();
    } catch (e) {
      console.error("Failed to download sqlite3:", e);
    }
  };

  const handleCancelSqlite3Download = () => {
    setShowSqlite3Dialog(false);
    store.setNeedsSqlite3Download(false);
  };

  const handleCancelBackup = () => {
    store.setShowBackupWarning(false);
  };

  const handleRestore = async (path: string) => {
    if (confirm(t("backup.confirmRestore"))) {
      try {
        await store.restoreBackup(path);
      } catch (e) {
        console.error("Restore failed:", e);
      }
    }
  };

  const handleDelete = async (path: string) => {
    if (confirm(t("backup.confirmDelete"))) {
      try {
        await store.deleteBackup(path);
      } catch (e) {
        console.error("Delete failed:", e);
      }
    }
  };

  const handleExport = async () => {
    try {
      const path = await save({
        title: t("backup.export"),
        defaultPath: "vaultwarden-backup.zip",
        filters: [{ name: "ZIP", extensions: ["zip"] }],
      });
      if (path) {
        await store.exportBackup(path);
      }
    } catch (e) {
      console.error("Export failed:", e);
    }
  };

  const handleImport = async () => {
    try {
      const path = await open({
        title: t("backup.import"),
        filters: [{ name: "ZIP", extensions: ["zip"] }],
        multiple: false,
      });
      if (path) {
        await store.importBackup(path as string);
      }
    } catch (e) {
      console.error("Import failed:", e);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      
      if (minutes < 1) return t("backup.justNow");
      if (minutes < 60) return t("backup.minutesAgo", { n: minutes });
      if (hours < 24) return t("backup.hoursAgo", { n: hours });
      return t("backup.daysAgo", { n: days });
    } catch {
      return dateStr;
    }
  };

  return (
    <div class="panel backup-panel">
      <div class="panel-title">{t("backup.management")}</div>
      
      <div class="backup-info-row">
        <div class="backup-info-card">
          <div class="backup-info-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
            </svg>
          </div>
          <div class="backup-info-content">
            <span class="backup-info-label">{t("backup.database")}</span>
            <span class="backup-info-value">data/db.sqlite3</span>
          </div>
        </div>
        <div class="backup-info-card">
          <div class="backup-info-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
          </div>
          <div class="backup-info-content">
            <span class="backup-info-label">{t("backup.lastBackup")}</span>
            <span class="backup-info-value">
              <Show when={store.lastBackup()} fallback={t("backup.noBackup")}>
                {store.lastBackup()} ({getRelativeTime(store.lastBackup()!)})
              </Show>
            </span>
          </div>
        </div>
      </div>

      <div class="backup-actions-row">
        <button
          class="btn btn-primary btn-backup"
          onClick={handleBackupNow}
          disabled={store.isBackingUp()}
        >
          <Show when={store.isBackingUp()} fallback={
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t("backup.backupNow")}
            </>
          }>
            <span class="spinner"></span>
            {t("backup.backingUp")}
          </Show>
        </button>
      </div>

      <div class="backup-actions-row">
        <button class="btn btn-secondary" onClick={handleExport}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {t("backup.export")}
        </button>
        <button class="btn btn-secondary" onClick={handleImport}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t("backup.import")}
        </button>
      </div>

      <Show when={showSqlite3Dialog()}>
        <div class="backup-warning">
          <div class="warning-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </div>
          <div class="warning-text">
            <div class="warning-title">{t("backup.sqlite3Required")}</div>
            <div class="warning-subtitle">
              {t("backup.sqlite3DownloadPrompt")}
            </div>
          </div>
          <div class="warning-actions">
            <button class="btn btn-primary btn-small" onClick={handleDownloadSqlite3}>
              {t("backup.downloadSqlite3")}
            </button>
            <button class="btn btn-secondary btn-small" onClick={handleCancelSqlite3Download}>
              {t("backup.cancel")}
            </button>
          </div>
        </div>
      </Show>

      <Show when={store.showBackupWarning()}>
        <div class="backup-warning">
          <div class="warning-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div class="warning-text">
            <div class="warning-title">{t("backup.activityWarning")}</div>
            <div class="warning-subtitle">
              {t("backup.activityHigh")}: {store.activityStatus()?.last_activity}
            </div>
          </div>
          <div class="warning-actions">
            <button class="btn btn-danger btn-small" onClick={handleForceBackup}>
              {t("backup.continue")}
            </button>
            <button class="btn btn-secondary btn-small" onClick={handleCancelBackup}>
              {t("backup.cancel")}
            </button>
          </div>
        </div>
      </Show>

      <div class="backup-list">
        <Show
          when={store.backups().length > 0}
          fallback={
            <div class="no-data">
              <div class="no-data-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
              </div>
              <span>{t("backup.noBackup")}</span>
            </div>
          }
        >
          <div class="backup-list-header">
            <span class="backup-col-name">{t("backup.database")}</span>
            <span class="backup-col-size">{t("backup.size")}</span>
            <span class="backup-col-time">{t("backup.time")}</span>
            <span class="backup-col-actions">{t("backup.actions")}</span>
          </div>
          <For each={store.backups()}>
            {(backup) => (
              <div class="backup-item">
                <span class="backup-col-name">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                  </svg>
                  {backup.filename}
                </span>
                <span class="backup-col-size">{formatSize(backup.size)}</span>
                <span class="backup-col-time">{getRelativeTime(backup.created_at)}</span>
                <span class="backup-col-actions">
                  <button
                    class="btn btn-success btn-small"
                    onClick={() => handleRestore(backup.path)}
                    disabled={store.isRunning()}
                    title={t("backup.restoreWarning")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="1,4 1,10 7,10" />
                      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                    {t("backup.restore")}
                  </button>
                  <button
                    class="btn btn-danger btn-small"
                    onClick={() => handleDelete(backup.path)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3,6 5,6 21,6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    {t("backup.delete")}
                  </button>
                </span>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};
