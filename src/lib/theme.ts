/**
 * Theme controller. The single visual switch is a `dark` class on <html>.
 * - "light" / "dark": forced.
 * - "system": follows prefers-color-scheme and updates live when the OS flips.
 *
 * The choice is mirrored to localStorage so the inline script in index.html can
 * pre-apply it before React mounts (no light flash). The user's authoritative
 * setting lives in their Firestore profile (prefs.appearance.theme); App reads
 * that and calls applyTheme on load and whenever it changes.
 */
export type ThemePref = "light" | "dark" | "system";

const KEY = "finia-theme";
const QUERY = "(prefers-color-scheme: dark)";

let mql: MediaQueryList | null = null;
let onSystemChange: ((e: MediaQueryListEvent) => void) | null = null;

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia(QUERY).matches
    : false;
}

function setDarkClass(dark: boolean): void {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", dark);
  }
}

function teardownSystemListener(): void {
  if (mql && onSystemChange) mql.removeEventListener("change", onSystemChange);
  mql = null;
  onSystemChange = null;
}

/** Apply a theme preference now and keep "system" live until the next applyTheme. */
export function applyTheme(pref: ThemePref): void {
  teardownSystemListener();
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* private mode / storage disabled — non-fatal */
  }

  if (pref === "system") {
    setDarkClass(systemPrefersDark());
    if (typeof window !== "undefined" && window.matchMedia) {
      mql = window.matchMedia(QUERY);
      onSystemChange = (e) => setDarkClass(e.matches);
      mql.addEventListener("change", onSystemChange);
    }
  } else {
    setDarkClass(pref === "dark");
  }
}

/** Last-applied preference from localStorage (used before the profile loads). */
export function storedThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "light";
}
