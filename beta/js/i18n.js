// Fitty — translations (English / Arabic).
// t('English text', { vars }) returns the text in the current language, falling back to English.
// Plurals: an entry can be an object of Intl plural categories — Arabic uses zero/one/two/few/many/other.
import { AR } from './lang-ar.js';

const LS_KEY = 'fitty:lang';
let lang = 'en';
try { lang = localStorage.getItem(LS_KEY) || 'en'; } catch { }

// English plural forms (everything else in English is the key itself).
const EN = {
  '{n} pieces': { one: '{n} piece', other: '{n} pieces' },
  '{n} outfits': { one: '{n} outfit', other: '{n} outfits' },
  '{n} days ago': { one: 'yesterday', other: '{n} days ago' },
  '{n} options for {day}': { one: '{n} option for {day}', other: '{n} options for {day}' },
  'in {n} fits': { one: 'in {n} fit', other: 'in {n} fits' },
  'Added {n} photos': { one: 'Added {n} photo', other: 'Added {n} photos' },
  'Adding {n} photos…': { one: 'Adding {n} photo…', other: 'Adding {n} photos…' },
  'days logged': { one: 'day logged', other: 'days logged' },
  'fits never worn': { one: 'fit never worn', other: 'fits never worn' },
  'days logged this month': { one: 'day logged this month', other: 'days logged this month' },
  'Based on {n} answers': { one: 'Based on {n} answer', other: 'Based on {n} answers' },
  '{n} photos were lost by the browser — tap the pieces marked 📷 to add them again': {
    one: '{n} photo was lost by the browser — tap the piece marked 📷 to add it again',
    other: '{n} photos were lost by the browser — tap the pieces marked 📷 to add them again',
  },
  'It will be removed from {n} fits: {names}.': { one: 'It will be removed from {n} fit: {names}.', other: 'It will be removed from {n} fits: {names}.' },
  '{n} fits in storage suit this weather': { one: '{n} fit in storage suits this weather', other: '{n} fits in storage suit this weather' },
  '{n} pieces in storage': { one: '{n} piece in storage', other: '{n} pieces in storage' },
  '{n} fits sit out': { one: '{n} fit sits out', other: '{n} fits sit out' },
  '{n} pieces put away': { one: '{n} piece put away', other: '{n} pieces put away' },
  '{n} fits will move to “No group”. The fits themselves stay.': {
    one: '{n} fit will move to “No group”. The fit itself stays.', other: '{n} fits will move to “No group”. The fits themselves stay.',
  },
};
const DICTS = { en: EN, ar: AR };

export const getLang = () => lang;
export const isRTL = () => lang === 'ar';
// Arabic text with Latin digits (0-9), which matches the temperatures and numbers across the app.
export const locale = () => (lang === 'ar' ? 'ar-IQ-u-nu-latn' : undefined);

export function setLang(l) {
  lang = l === 'ar' ? 'ar' : 'en';
  try { localStorage.setItem(LS_KEY, lang); } catch { }
  applyLang();
}

export function applyLang() {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

const rules = {};
export function t(key, vars = {}) {
  let s = DICTS[lang][key] ?? EN[key] ?? key;
  if (typeof s === 'object') {
    const n = Number(vars.n ?? 0);
    if (lang === 'ar' && n === 0 && s.zero) s = s.zero;
    else {
      const pr = rules[lang] || (rules[lang] = new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en'));
      s = s[pr.select(n)] ?? s.other;
    }
  }
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

// Dates in the current language.
export function fmtDate(d, opts) { return d.toLocaleDateString(locale(), opts); }
