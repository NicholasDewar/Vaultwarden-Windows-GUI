import { createSignal, createContext, useContext, ParentComponent, createMemo } from "solid-js";
import { flatten, translator, Translator, Flatten } from "@solid-primitives/i18n";
import { zh } from "./zh";
import { en } from "./en";

type Locale = "zh" | "en";
type RawDictionary = typeof zh;

const dictionaries: Record<Locale, RawDictionary> = { zh, en };

interface I18nContextValue {
  locale: () => Locale;
  setLocale: (locale: Locale) => void;
  t: Translator<Flatten<RawDictionary>>;
}

const I18nContext = createContext<I18nContextValue>();

export const I18nProvider: ParentComponent = (props) => {
  const [locale, setLocale] = createSignal<Locale>("zh");

  const flatDict = createMemo(() => flatten(dictionaries[locale()]));
  const t = createMemo(() => translator(flatDict));

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: t() }}>
      {props.children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
};
