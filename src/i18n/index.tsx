import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import zh, { type Translations } from './zh';
import en from './en';

type Lang = 'zh' | 'en';

const translations: Record<Lang, Translations> = { zh, en };

interface I18nContextType {
  lang: Lang;
  t: Translations;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'zh',
  t: zh,
  setLang: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('language');
      if (saved === 'en' || saved === 'zh') return saved;
    } catch {}
    return 'zh';
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('language', l); } catch {}
  }, []);

  const value: I18nContextType = {
    lang,
    t: translations[lang],
    setLang,
  };

  return React.createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nContextType {
  return useContext(I18nContext);
}

/** Replace `{key}` placeholders with values from params */
export function format(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? `{${key}}`));
}
