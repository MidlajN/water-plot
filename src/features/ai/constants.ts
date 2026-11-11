/** AI Creative Studio constants shared by server and browser (no dependencies). */

export const DESIGN_CATEGORIES = ["poetry", "line_art", "combination", "custom"] as const;
export type DesignCategory = (typeof DESIGN_CATEGORIES)[number];

/**
 * What makes the design: "vector" asks the language model for SVG directly (Gemini or
 * Groq); the image engines draw a raster line drawing that's traced into pen strokes.
 */
export const DESIGN_ENGINES = ["vector", "flux", "openai"] as const;
export type DesignEngine = (typeof DESIGN_ENGINES)[number];
export type ImageEngine = Exclude<DesignEngine, "vector">;

export const ENGINE_LABELS: Record<DesignEngine, string> = {
    vector: "Vector AI",
    flux: "FLUX",
    openai: "OpenAI",
};

export const isImageEngine = (engine: DesignEngine): engine is ImageEngine => engine !== "vector";

export const TEXT_FONTS = ["script", "sans", "serif"] as const;
export type TextFont = (typeof TEXT_FONTS)[number];

/** Model font names → bundled single-line font ids (src/features/workspace/text/fonts). */
export const FONT_IDS: Record<TextFont, string> = {
    script: "HersheyScript1",
    sans: "HersheySans1",
    serif: "HersheySerifMed",
};

export const LIMITS = {
    promptMin: 3,
    promptMax: 500,
    refinementMax: 300,
    textLinesMax: 6,
    textLineMax: 80,
    svgMax: 60_000,
    titleMax: 80,
    descriptionMax: 240,
    questionMax: 200,
    suggestionsMax: 3,
    messageMax: 240,
} as const;

/** Blank margin kept on every side of the working area, in mm. */
export const MARGIN_MM = 10;
