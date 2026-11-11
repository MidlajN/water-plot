/**
 * The image prompt: the person's idea wrapped in fixed line-art wording, so the picture
 * traces into clean pen strokes. A template rather than an extra language-model call:
 * it costs nothing, adds no delay and doesn't use up the Gemini free tier.
 *
 * It only says what to draw. Image models tend to draw what a prompt names even after
 * "no" ("no ground line" brings ground lines), so unwanted things aren't mentioned.
 */
export function lineArtPrompt(idea: string, refinement?: string): string {
    const subject = cleanIdea(idea) || idea.trim();
    const change = refinement?.trim().replace(/[.!\s]+$/, "");
    return [
        `A minimalist black ink line drawing of ${subject}.`,
        change ? `Variation: ${change}.` : "",
        "Clean outlines of one even, medium line weight, like a fine-liner pen illustration; open white shapes, simple outline art.",
        "The subject is isolated, floating in the centre of a plain pure-white page with lots of empty white space around it.",
    ]
        .filter(Boolean)
        .join(" ");
}

/** A short title from the idea ("draw me a heron at dawn" → "Heron at dawn"). */
export function titleFromIdea(idea: string, max = 48): string {
    let title = cleanIdea(idea)
        .replace(/^(an?|the)\s+/i, "")
        .replace(/^((minimal(ist)?|simple|clean|continuous[- ]line|single[- ]line|one[- ]line|line)\s+)+(drawing|illustration|art|sketch)\s+of\s+(an?\s+|the\s+)?/i, "");
    if (title.length > max) title = `${title.slice(0, max).replace(/\s+\S*$/, "")}…`;
    return title ? title[0].toUpperCase() + title.slice(1) : "Line drawing";
}

/** The idea without a leading request ("please draw me …") or trailing punctuation. */
function cleanIdea(idea: string): string {
    return idea
        .trim()
        .replace(/\s+/g, " ")
        .replace(/[.!?\s]+$/, "")
        .replace(/^(please\s+)?(can you\s+)?(draw|make|create|generate|sketch|design)(\s+me)?\s+/i, "");
}
