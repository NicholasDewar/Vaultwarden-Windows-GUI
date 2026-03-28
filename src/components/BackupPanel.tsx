import { Component, Show, For } from "solid-js";
import { useI18n } from "../i18n";
import { appStore } from "../stores/appStore";

export const BackupPanel: Component = () => {
  const { t } = useI18n();
  const store = appStore;

  const handleBackupNow = async () => {
    await store.checkDatabaseActivity();
    await store.performBackup();
  };

  const handleForceBackup = async () => {
    await store.forceBackup();
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
      
      if (minutes < 1) return "刚刚";
      if (minutes < 60) return `${minutes} 分钟前`;
      if (hours < 24) return `${hours} 小时前`;
      return `${days} 天前`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div class="panel backup-panel">
      <div class="panel-title">{t("backup.management")}</div>
      
      <div class="backup-info-row">
        <div class="backup-info-item">
          <span class="backup-info-label">{t("backup.database")}:</span>
          <span class="backup-info-value">data/db.sqlite3</span>
        </div>
        <div class="backup-info-item">
          <span class="backup-info-label">{t("backup.lastBackup")}:</span>
          <span class="backup-info-value">
            <Show when={store.lastBackup()} fallback={t("backup.noBackup")}>
              {store.lastBackup()} ({getRelativeTime(store.lastBackup()!)})
            </Show>
          </span>
        </div>
      </div>

      <div class="backup-actions-row">
        <button
          class="btn btn-primary"
          onClick={handleBackupNow}
          disabled={store.isBackingUp()}
        >
          <Show when={store.isBackingUp()} fallback={<span>📦 {t("backup.backupNow")}</span>}>
            <span class="spinner"></span>
            {t("backup.backingUp")}
          </Show>
        </button>
      </div>

      <Show when={store.showBackupWarning()}>
        <div class="backup-warning">
          <div class="warning-icon">⚠️</div>
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
            <div class="no-data">{t("backup.noBackup")}</div>
          }
        >
          <div class="backup-list-header">
            <span class="backup-col-name">{t("backup.database")}</span>
            <span class="backup-col-size">大小</span>
            <span class="backup-col-time">时间</span>
            <span class="backup-col-actions">操作</span>
          </div>
          <For each={store.backups()}>
            {(backup) => (
              <div class="backup-item">
                <span class="backup-col-name">
                  💾 {backup.filename}
                </span>
                <span class="backup-col-size">
                  {formatSize(backup.size)}
                </span>
                <span class="backup-col-time">
                  {getRelativeTime(backup.created_at)}
                </span>
                <span class="backup-col-actions">
                  <button
                    class="btn btn-success btn-small"
                    onClick={() => handleRestore(backup.path)}
                    disabled={store.isRunning()}
                    title={t("backup.restoreWarning")}
                  >
                    {t("backup.restore")}
                  </button>
                  <button
                    class="btn btn-danger btn-small"
                    onClick={() => handleDelete(backup.path)}
                  >
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
