import { Component, Show } from "solid-js";
import { useI18n } from "../i18n";
import { appStore } from "../stores/appStore";
import { Download, Check, ArrowUp, X } from "lucide-solid";

interface UpdateButtonProps {
  onUpdateAvailable?: () => void;
}

export const UpdateButton: Component<UpdateButtonProps> = (props) => {
  const { t } = useI18n();
  const store = appStore;

  const handleDownloadUpdate = async () => {
    try {
      await store.downloadGuiUpdate();
    } catch (e) {
      console.error("Download update failed:", e);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await store.installGuiUpdate();
    } catch (e) {
      console.error("Install update failed:", e);
    }
  };

  const handleCloseUpdate = () => {
    store.setGuiUpdate(null);
  };

  return (
    <Show when={store.guiUpdate()}>
      <div class="update-banner">
        <div class="update-info">
          <ArrowUp size={18} />
          <span>
            {t("messages.updateAvailable")}: v{store.guiUpdate()?.latest_version}
          </span>
        </div>
        <div class="update-actions">
          <Show when={!store.isDownloadingGui()}>
            <button
              class="btn btn-primary btn-small"
              onClick={handleDownloadUpdate}
            >
              <Download size={14} />
              {t("versions.download")}
            </button>
          </Show>
          <Show when={store.isDownloadingGui()}>
            <div class="update-progress">
              <span class="spinner"></span>
              {store.downloadGuiProgress()}%
            </div>
          </Show>
          <button
            class="btn btn-icon btn-secondary"
            onClick={handleCloseUpdate}
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </Show>
  );
};
