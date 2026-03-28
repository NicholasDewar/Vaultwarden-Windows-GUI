import { Component, createSignal, Show } from "solid-js";
import { useI18n } from "../i18n";

export const LanguageSwitcher: Component = () => {
  const { locale, setLocale } = useI18n();
  const [isOpen, setIsOpen] = createSignal(false);

  const languages = [
    { code: "zh" as const, label: "中文", flag: "🇨🇳" },
    { code: "en" as const, label: "English", flag: "🇺🇸" },
  ];

  const currentLang = () => languages.find((l) => l.code === locale()) || languages[0];

  const handleSelect = (code: "zh" | "en") => {
    setLocale(code);
    setIsOpen(false);
  };

  return (
    <div class="language-switcher">
      <button
        class="language-trigger"
        onClick={() => setIsOpen(!isOpen())}
        aria-expanded={isOpen()}
        aria-haspopup="listbox"
      >
        <span class="language-flag">{currentLang().flag}</span>
        <span class="language-label">{currentLang().label}</span>
        <span class={`language-arrow ${isOpen() ? "open" : ""}`}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </button>

      <Show when={isOpen()}>
        <div class="language-backdrop" onClick={() => setIsOpen(false)} />
        <div class="language-menu" role="listbox">
          {languages.map((lang) => (
            <button
              class={`language-option ${locale() === lang.code ? "active" : ""}`}
              onClick={() => handleSelect(lang.code)}
              role="option"
              aria-selected={locale() === lang.code}
            >
              <span class="language-flag">{lang.flag}</span>
              <span class="language-option-label">{lang.label}</span>
              <Show when={locale() === lang.code}>
                <span class="language-check">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </span>
              </Show>
            </button>
          ))}
        </div>
      </Show>
    </div>
  );
};
