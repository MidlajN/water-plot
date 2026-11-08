import type { SingleLineFont } from "./fonts";

type Glyph = SingleLineFont["glyphs"][string];
type Command = [op: string, ...coords: number[]];

const parsedGlyphs = new WeakMap<SingleLineFont, Map<string, Command[]>>();

/** Whitespace is blank; anything else the font lacks is drawn as "?". */
function resolveGlyph(font: SingleLineFont, char: string): Glyph {
    return (
        font.glyphs[char] ??
        (/\s/.test(char) ? font.glyphs[" "] : font.glyphs["?"]) ??
        [font.advance]
    );
}

function parseGlyph(font: SingleLineFont, char: string): Command[] {
    let cache = parsedGlyphs.get(font);
    if (!cache) {
        cache = new Map();
        parsedGlyphs.set(font, cache);
    }

    let commands = cache.get(char);
    if (!commands) {
        commands = [];
        for (const token of resolveGlyph(font, char)[1]?.split(" ") ?? []) {
            if (/^[A-Z]$/.test(token)) commands.push([token]);
            else commands[commands.length - 1].push(Number(token));
        }
        cache.set(char, commands);
    }
    return commands;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Advance width of a character at the given font size. */
export function glyphAdvance(font: SingleLineFont, char: string, fontSize: number): number {
    return (resolveGlyph(font, char)[0] * fontSize) / font.unitsPerEm;
}

/** Path data for a single line of text with its baseline at y = ascent, e.g. for previews. */
export function textToPathData(font: SingleLineFont, text: string, fontSize: number) {
    const out: string[] = [];
    const baseline = (font.ascent * fontSize) / font.unitsPerEm;
    let x = 0;

    for (const char of text) {
        appendGlyphPath(out, font, char, x, baseline, fontSize);
        x += glyphAdvance(font, char, fontSize);
    }

    return {
        d: out.join(" "),
        width: x,
        height: ((font.ascent - font.descent) * fontSize) / font.unitsPerEm,
    };
}

/**
 * Appends the SVG path data for one character, with its origin at (x, baseline)
 * in canvas coordinates (y pointing down).
 */
export function appendGlyphPath(
    out: string[],
    font: SingleLineFont,
    char: string,
    x: number,
    baseline: number,
    fontSize: number,
) {
    const scale = fontSize / font.unitsPerEm;

    for (const [op, ...coords] of parseGlyph(font, char)) {
        out.push(op);
        for (let i = 0; i < coords.length; i += 2) {
            out.push(String(round(x + coords[i] * scale)), String(round(baseline - coords[i + 1] * scale)));
        }
    }
}
