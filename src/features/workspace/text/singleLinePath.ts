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

/** Width of a line of text at the given font size. */
export function measureText(font: SingleLineFont, text: string, fontSize: number): number {
    let width = 0;
    for (const char of text) width += glyphAdvance(font, char, fontSize);
    return width;
}

/** Path data for a single line of text with its baseline at y = ascent, e.g. for previews. */
export function textToPathData(font: SingleLineFont, text: string, fontSize: number) {
    const writer = new GlyphPathWriter(font, fontSize);
    const baseline = (font.ascent * fontSize) / font.unitsPerEm;
    writer.addLine(text, 0, baseline);

    return {
        d: writer.finish(),
        width: measureText(font, text, fontSize),
        height: ((font.ascent - font.descent) * fontSize) / font.unitsPerEm,
    };
}

/**
 * Builds SVG path data glyph by glyph, with each glyph's origin at (x, baseline)
 * in canvas coordinates (y pointing down).
 *
 * For joined fonts the order is chosen for plotting: each word's letters are written
 * as one continuous run, and their separate marks (i dots, t bars...) follow at the end
 * of the word, so a plotter that keeps document order lowers the pen once per word plus
 * once per mark, like a hand writing the word and then dotting it.
 */
export class GlyphPathWriter {
    private readonly out: string[] = [];
    private marks: string[] = [];

    constructor(
        private readonly font: SingleLineFont,
        private readonly fontSize: number,
    ) {}

    add(char: string, x: number, baseline: number) {
        if (/\s/.test(char)) {
            this.endWord();
            return;
        }

        const scale = this.fontSize / this.font.unitsPerEm;
        let target = this.out;
        let subpath = 0;

        for (const [op, ...coords] of parseGlyph(this.font, char)) {
            if (op === "M" && subpath++ === 1 && this.font.joined) target = this.marks;
            target.push(op);
            for (let i = 0; i < coords.length; i += 2) {
                target.push(String(round(x + coords[i] * scale)), String(round(baseline - coords[i + 1] * scale)));
            }
        }
    }

    /** Adds a line of text starting at (x, baseline), then ends its last word. */
    addLine(text: string, x: number, baseline: number) {
        for (const char of text) {
            this.add(char, x, baseline);
            x += glyphAdvance(this.font, char, this.fontSize);
        }
        this.endWord();
    }

    /** Flushes the current word's marks; call at the end of each line. */
    endWord() {
        this.out.push(...this.marks);
        this.marks = [];
    }

    finish(): string {
        this.endWord();
        return this.out.join(" ");
    }
}
