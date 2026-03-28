import { Component, For, Show } from "solid-js";
import { useI18n } from "../i18n";
import { appStore, ReleaseInfo } from "../stores/appStore";

export const VersionList: Component = () => {
  const { t } = useI18n();
  const {
    releases,
    latestVersion,
    downloadingVersion,
    downloadProgress,
    downloadBinary,
  } = appStore;

  const handleDownload = async (version: string) => {
    try {
      await downloadBinary(version);
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div class="panel">
      <div class="panel-title">{t("versions.title")}</div>
      <Show
        when={releases().length > 0}
        fallback={<div class="no-data">{t("versions.noVersions")}</div>}
      >
        <div class="version-list">
          <For each={releases()}>
            {(release: ReleaseInfo) => (
              <div class="version-item">
                <div class="version-info">
                  <div class="version-tag">
                    {release.tag}
                    <Show when={release.tag === latestVersion()}>
                      <span class="version-badge">{t("versions.latest")}</span>
                    </Show>
                  </div>
                  <div class="version-date">
                    {formatDate(release.published_at)}
                    <Show when={release.assets.length > 0}>
                      {" - "}
                      {formatSize(release.assets[0].size)}
                    </Show>
                  </div>
                  <Show when={downloadingVersion() === release.tag}>
                    <div class="download-progress">
                      <span>{t("versions.downloading")}</span>
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          style={{ width: `${downloadProgress()}%` }}
                        />
                      </div>
                      <span>{downloadProgress()}%</span>
                    </div>
                  </Show>
                </div>
                <div class="version-actions">
                  <Show when={downloadingVersion() !== release.tag}>
                    <button
                      class="btn btn-primary btn-small"
                      onClick={() => handleDownload(release.tag)}
                    >
                      {t("versions.download")}
                    </button>
                  </Show>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
