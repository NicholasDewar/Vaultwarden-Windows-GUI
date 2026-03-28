import { Component } from "solid-js";
import { useI18n } from "../i18n";

export const LanguageSwitcher: Component = () => {
  const { locale, setLocale } = useI18n();

  return (
    <select
      class="language-select"
      value={locale()}
      onChange={(e) => setLocale(e.currentTarget.value as "zh" | "en")}
    >
      <option value="zh">中文</option>
      <option value="en">English</option>
    </select>
  );
};
