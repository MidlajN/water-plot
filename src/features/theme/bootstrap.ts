/** localStorage key holding the viewer's choice: "light", "dark" or "system" (default). */
export const THEME_STORAGE_KEY = "plotter-studio:theme";

/**
 * Inline <head> script: resolves the theme and sets <html data-theme> synchronously,
 * before first paint, so there's no light flash in dark mode. Kept tiny and
 * dependency-free; ThemeProvider takes over after hydration.
 */
export const THEME_BOOTSTRAP = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var d=c==="dark"||(c!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;
