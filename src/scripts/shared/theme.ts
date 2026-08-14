/**
 * Theme preference, shared by the reader, the article sandbox and the options page.
 *
 * The stylesheets do the real work: `theme.css` declares the default colours through
 * `light-dark()` under `color-scheme: light dark`, so "auto" already follows the
 * browser with no script at all, and each named palette restates those colours under
 * its own `data-theme` selector. All this module does is pin the explicit choice onto
 * `<html>` and answer "light or dark?" for the toolbar toggle.
 */

export type ThemePreference = "auto" | "light" | "dark" | "oled" | "sepia" | "nord";
export type ResolvedTheme = "light" | "dark";

/** Which base scheme each named palette reads as, for the toggle and its icon. */
const THEME_SCHEMES = {
    light: "light",
    dark: "dark",
    oled: "dark",
    sepia: "light",
    nord: "dark",
} as const satisfies Record<Exclude<ThemePreference, "auto">, ResolvedTheme>;

export const THEME_PREFERENCES: readonly ThemePreference[] = [
    "auto",
    ...(Object.keys(THEME_SCHEMES) as Exclude<ThemePreference, "auto">[]),
];

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
    return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
    if (preference !== "auto") {
        return THEME_SCHEMES[preference];
    }
    return prefersDark ? "dark" : "light";
}

/**
 * What the toggle button should switch to: always an explicit choice, so a user
 * on "auto" gets the opposite of what they are looking at rather than a no-op.
 * A named palette toggles to plain light or dark rather than to its own inverse,
 * since none of them come in pairs.
 */
export function toggledTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
    return resolveTheme(preference, prefersDark) === "dark" ? "light" : "dark";
}

export function prefersDarkScheme(): boolean {
    return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches;
}

/** Applies the preference to a document, including the sandbox iframe's own. */
export function applyTheme(target: Document | null | undefined, preference: ThemePreference): void {
    target?.documentElement?.setAttribute("data-theme", preference);
}
