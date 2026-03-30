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
    const minutes = parseInt(value) || 5;
    store.setBackupConfig((prev) => ({ ...prev, min_diff_interval: minutes }));
  };

  const handleRetentionChange = (value: string) => {
    const count = parseInt(value) || 7;
    store.setBackupConfig((prev) => ({ ...prev, keep_versions: count }));
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

  return (
    <div class="panel backup-settings">
      <div class="panel-title">{t("backup.title")}</div>
      
      <div class="backup-settings-form">
        <div class="backup-setting-row">
          <div class="toggle-wrapper">
            <span class="toggle-label">{t("backup.enable")}</span>
            <button
              class={`toggle-switch ${store.backupConfig().enabled ? "active" : ""}`}
              onClick={handleToggleEnabled}
              role="switch"
              aria-checked={store.backupConfig().enabled}
            >
              <span class="toggle-slider" />
            </button>
          </div>
        </div>

        <div class="backup-setting-row">
          <div class="form-group">
            <label class="form-label">{t("backup.interval")}</label>
            <div class="input-with-suffix modern-input">
              <input
                type="number"
                class="form-input styled-number"
                value={store.backupConfig().min_diff_interval}
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
            <div class="input-with-suffix modern-input">
              <input
                type="number"
                class="form-input styled-number"
                value={store.backupConfig().keep_versions}
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
            <div class="input-with-button modern-input">
              <input
                type="text"
                class="form-input"
                value={store.backupConfig().custom_dir || ""}
                onInput={(e) => handleCustomDirChange(e.currentTarget.value)}
                placeholder={t("backup.defaultDir")}
                disabled={!store.backupConfig().enabled}
              />
              <button
                class="btn btn-secondary btn-small btn-icon-only"
                onClick={handleBrowse}
                disabled={!store.backupConfig().enabled}
                title={t("backup.browse")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17,21 17,13 7,13 7,21" />
              <polyline points="7,3 7,8 15,8" />
            </svg>
            {t("backup.save")}
          </button>
        </div>
      </div>
    </div>
  );
};
