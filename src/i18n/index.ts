import { en, type Key } from './en';
import { sl } from './sl';
import { readItem, writeItem } from '../core/storage';

export type { Key };
export type Lang = 'sl' | 'en';

const tables: Record<Lang, Record<Key, string>> = { en, sl };
export const LANGS: Lang[] = ['sl', 'en'];
const STORAGE_KEY = 'lang';
const DEFAULT_LANG: Lang = 'sl';

function isLang(v: unknown): v is Lang { return v === 'sl' || v === 'en'; }

/** `?lang=` in the URL wins (and is remembered), then the saved choice, then the default. */
function detect(): Lang {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (isLang(fromUrl)) { writeItem(STORAGE_KEY, fromUrl); return fromUrl; }
  const saved = readItem(STORAGE_KEY);
  return isLang(saved) ? saved : DEFAULT_LANG;
}

let lang: Lang = detect();

/** Keep the DOM chrome (html lang, reload button label) in sync with the current language. */
function applyToDom(): void {
  document.documentElement.lang = lang;
  document.getElementById('reload')?.setAttribute('aria-label', t('ui.reload'));
}

export function getLang(): Lang { return lang; }

export function setLang(next: Lang): void {
  lang = next;
  writeItem(STORAGE_KEY, next);
  applyToDom();
}

/** Translate `key`, replacing `{name}` placeholders with `params.name`. */
export function t(key: Key, params?: Record<string, string | number>): string {
  const s = tables[lang][key] ?? en[key];
  return params ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m)) : s;
}

applyToDom();
