import { Component, Show } from "solid-js";
import { useI18n } from "../i18n";
import { appStore, BackupConfig } from "../stores/appStore";

export const BackupSettings: Component = () => {
  const { t } = useI18n();
  const store = appStore;

  const handleToggleEnabled = () => {
    store.setBackupConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
  };

  const handleIntervalChange = (value: string) => {
    const minutes = parseInt(value) || 10;
    store.setBackupConfig((prev) => ({ ...prev, interval_minutes: minutes }));
  };

  const handleRetentionChange = (value: string) => {
    const count = parseInt(value) || 7;
    store.setBackupConfig((prev) => ({ ...prev, retention_count: count }));
  };

  const handleCustomDirChange = (value: string) => {
    store.setBackupConfig((prev) => ({ 
      ...prev, 
      custom_dir: value.trim() || null 
    }));
  };

  const handleBrowse = async () => {
    await store.selectBackupDirectory();
  };

  const handleSave = async () => {
    try {
      await store.saveBackupConfig(store.backupConfig());
      store.setError(null);
    } catch (e) {
      console.error("Save backup config failed:", e);
    }
  };

  const handleDeleteTask = async () => {
    try {
      await store.saveBackupConfig({ ...store.backupConfig(), enabled: false });
    } catch (e) {
      console.error("Delete task failed:", e);
    }
  };

  return (
    <div class="panel backup-settings">
      <div class="panel-title">{t("backup.title")}</div>
      
      <div class="backup-settings-form">
        <div class="backup-setting-row">
          <label class="form-checkbox-wrapper">
            <input
              type="checkbox"
              class="form-checkbox"
              checked={store.backupConfig().enabled}
              onChange={handleToggleEnabled}
            />
            <span>{t("backup.enable")}</span>
          </label>
        </div>

        <div class="backup-setting-row">
          <div class="form-group">
            <label class="form-label">{t("backup.interval")}</label>
            <div class="input-with-suffix">
              <input
                type="number"
                class="form-input"
                value={store.backupConfig().interval_minutes}
                onInput={(e) => handleIntervalChange(e.currentTarget.value)}
                min="1"
                max="1440"
                disabled={!store.backupConfig().enabled}
              />
              <span class="input-suffix">{t("backup.intervalMinutes")}</span>
            </div>
          </div>
        </div>

        <div class="backup-setting-row">
          <div class="form-group">
            <label class="form-label">{t("backup.retention")}</label>
            <div class="input-with-suffix">
              <input
                type="number"
                class="form-input"
                value={store.backupConfig().retention_count}
                onInput={(e) => handleRetentionChange(e.currentTarget.value)}
                min="1"
                max="100"
                disabled={!store.backupConfig().enabled}
              />
              <span class="input-suffix">{t("backup.retentionCount")}</span>
            </div>
          </div>
        </div>

        <div class="backup-setting-row">
          <div class="form-group">
            <label class="form-label">{t("backup.backupDir")}</label>
            <div class="input-with-button">
              <input
                type="text"
                class="form-input"
                value={store.backupConfig().custom_dir || ""}
                onInput={(e) => handleCustomDirChange(e.currentTarget.value)}
                placeholder={t("backup.defaultDir")}
                disabled={!store.backupConfig().enabled}
              />
              <button
                class="btn btn-secondary btn-small"
                onClick={handleBrowse}
                disabled={!store.backupConfig().enabled}
              >
                📁 {t("backup.browse")}
              </button>
            </div>
          </div>
        </div>

        <div class="backup-setting-actions">
          <button
            class="btn btn-primary"
            onClick={handleSave}
            disabled={!store.backupConfig().enabled}
          >
            💾 {t("backup.save")}
          </button>
          <Show when={store.scheduledTaskExists()}>
            <button
              class="btn btn-danger btn-small"
              onClick={handleDeleteTask}
            >
              🗑 {t("backup.deleteTask")}
            </button>
          </Show>
        </div>
      </div>
    </div>
  );
};
