/**
 * Canvas colours from the design tokens. Fabric and the 2D context can't read CSS
 * variables (or always parse oklch), so the tokens are resolved here, in the context of
 * the canvas element (so a themed ancestor applies), into rgb()/rgba() strings.
 */
export interface CanvasTheme {
    /** Ruler band background and the mask behind highlighted values. */
    rulerBackground: string;
    rulerText: string;
    rulerTick: string;
    /** Selection border, handles and the ruler highlight. */
    accent: string;
    accentSoft: string;
    /** Selection border while an object sits partly off the page. */
    warning: string;
    /** Handle fill. */
    handleFill: string;
    /** The sheet (softened in dark) and its shadow on the desk. */
    paper: string;
    paperShadow: string;
    paperContact: string;
    /** Registration marks at the page corners. */
    mark: string;
    /** UI font stack for ruler numbers. */
    fontFamily: string;
}

let probe: CanvasRenderingContext2D | null = null;

/** Any CSS colour (including oklch and color-mix) as rgba(), via a 1×1 canvas. */
function toRgba(color: string, alpha = 1): string {
    probe ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
    if (!probe) return color;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
    return `rgba(${r}, ${g}, ${b}, ${((a / 255) * alpha).toFixed(3)})`;
}

export function readCanvasTheme(element: Element): CanvasTheme {
    const style = getComputedStyle(element);
    const token = (name: string) => style.getPropertyValue(name).trim();
    const dark = element.closest("[data-theme]")?.getAttribute("data-theme") === "dark";

    return {
        rulerBackground: toRgba(token("--surface")),
        rulerText: toRgba(token("--text-subtle")),
        rulerTick: toRgba(token("--line-strong")),
        accent: toRgba(token("--accent")),
        accentSoft: toRgba(token("--accent"), 0.28),
        warning: toRgba(token("--danger")),
        handleFill: toRgba(token("--surface-raised")),
        paper: toRgba(token("--paper")),
        paperShadow: dark ? "rgba(0, 0, 0, 0.55)" : "rgba(31, 39, 51, 0.16)",
        paperContact: dark ? "rgba(0, 0, 0, 0.5)" : "rgba(31, 39, 51, 0.1)",
        mark: toRgba(token("--line-strong")),
        fontFamily: style.fontFamily || "system-ui, sans-serif",
    };
}
