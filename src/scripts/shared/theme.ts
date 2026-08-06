/**
 * Theme preference, shared by the reader, the article sandbox and the options page.
 *
 * The stylesheets do the real work: `theme.css` declares every colour through
 * `light-dark()` under `color-scheme: light dark`, so "auto" already follows the
 * browser with no script at all. All this module does is pin the two explicit
 * overrides onto `<html>` and answer "which one is showing right now" for the
 * toolbar toggle.
 */

export type ThemePreference = "auto" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: readonly ThemePreference[] = ["auto", "light", "dark"];

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function isThemePreference(value: unknown): value is ThemePreference {
    return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
    if (preference === "light" || preference === "dark") {
        return preference;
    }
    return prefersDark ? "dark" : "light";
}

/**
 * What the toggle button should switch to: always an explicit choice, so a user
 * on "auto" gets the opposite of what they are looking at rather than a no-op.
 */
export function toggledTheme(
    preference: ThemePreference,
    prefersDark: boolean
): Exclude<ThemePreference, "auto"> {
    return resolveTheme(preference, prefersDark) === "dark" ? "light" : "dark";
}

export function prefersDarkScheme(): boolean {
    return typeof matchMedia === "function" && matchMedia(DARK_QUERY).matches;
}

/** Applies the preference to a document, including the sandbox iframe's own. */
export function applyTheme(target: Document | null | undefined, preference: ThemePreference): void {
    target?.documentElement?.setAttribute("data-theme", preference);
}
