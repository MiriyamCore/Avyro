export type ColorSchemePreference = 'LIGHT' | 'DARK' | 'SYSTEM';

export const COLOR_SCHEME_STORAGE_KEY = 'ac-color-scheme';
export const COLOR_SCHEME_EVENT = 'ac:color-scheme';
export const DEFAULT_COLOR_SCHEME: ColorSchemePreference = 'DARK';

export function resolveColorScheme(preference: ColorSchemePreference): 'light' | 'dark' {
  if (preference === 'SYSTEM') {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
    return 'light';
  }
  return preference === 'DARK' ? 'dark' : 'light';
}

export function applyColorScheme(preference: ColorSchemePreference) {
  if (typeof document === 'undefined') return;
  const resolved = resolveColorScheme(preference);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  try {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, preference);
  } catch {
    /* ignore storage errors */
  }
}

export function readStoredColorScheme(): ColorSchemePreference | null {
  try {
    const value = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    if (value === 'LIGHT' || value === 'DARK' || value === 'SYSTEM') {
      return value;
    }
  } catch {
    /* ignore storage errors */
  }
  return null;
}

export const themeInitScript = `(function(){try{var s=localStorage.getItem('${COLOR_SCHEME_STORAGE_KEY}');var pref=s==='LIGHT'||s==='DARK'||s==='SYSTEM'?s:'${DEFAULT_COLOR_SCHEME}';var dark=pref==='DARK'||(pref==='SYSTEM'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark);}catch(e){document.documentElement.classList.add('dark');}})();`;
