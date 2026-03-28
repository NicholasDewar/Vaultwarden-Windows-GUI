import { Component, createSignal, createEffect, onMount } from "solid-js";

export type Theme = "light" | "dark" | "system";

export const ThemeSwitcher: Component = () => {
  const [theme, setTheme] = createSignal<Theme>("system");
  const [systemTheme, setSystemTheme] = createSignal<"light" | "dark">("dark");

  onMount(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemTheme(mediaQuery.matches ? "dark" : "light");

    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);

    const savedTheme = localStorage.getItem("theme") as Theme | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  });

  createEffect(() => {
    const current = theme() === "system" ? systemTheme() : theme();
    document.documentElement.setAttribute("data-theme", current);
    localStorage.setItem("theme", theme());
  });

  const getIcon = () => {
    if (theme() === "system") {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      );
    }
    return theme() === "dark" ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ) : (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    );
  };

  const toggleTheme = () => {
    if (theme() === "system") {
      setTheme(systemTheme() === "dark" ? "light" : "dark");
    } else {
      setTheme(theme() === "dark" ? "light" : "dark");
    }
  };

  const cycleTheme = (e: MouseEvent) => {
    e.stopPropagation();
    if (theme() === "system") {
      setTheme(systemTheme() === "dark" ? "light" : "dark");
    } else if (theme() === "dark") {
      setTheme("light");
    } else {
      setTheme("system");
    }
  };

  return (
    <button
      class="theme-switcher"
      onClick={toggleTheme}
      title={`Theme: ${theme()}${theme() === "system" ? ` (${systemTheme()})` : ""}`}
    >
      <span class="theme-icon">{getIcon()}</span>
      <span class="theme-label" onClick={cycleTheme}>
        {theme() === "system" ? "Auto" : theme() === "dark" ? "Dark" : "Light"}
      </span>
    </button>
  );
};
