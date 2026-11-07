import { IText, Path, classRegistry, util, type ITextProps } from "fabric";

import { DEFAULT_FONT_ID, getSingleLineFont } from "./fonts";
import { appendGlyphPath, glyphAdvance } from "./singleLinePath";

type SVGReviver = (markup: string) => string;

/**
 * Editable text drawn with single-line (stroke) fonts.
 *
 * Extends IText so typing, cursor and selection keep working, but replaces
 * character measuring and rendering: each glyph is stroked once along its
 * centre line, and toSVG()/toPath() export the same strokes as plain path
 * data. What the editor shows is exactly what the pen draws.
 *
 * Per-character styles are not supported; the whole object uses one font,
 * size and stroke.
 */
export class SingleLineText extends IText {
    static type = "SingleLineText";

    static ownDefaults: typeof IText.ownDefaults = {
        ...IText.ownDefaults,
        fontFamily: DEFAULT_FONT_ID,
        fill: "",
        stroke: "#111111",
        strokeWidth: 1,
        strokeLineCap: "round",
        strokeLineJoin: "round",
        cursorColor: "#000000",
        // Line box matches the bundled fonts: ascent 800 / descent -200 per 1000 units.
        _fontSizeMult: 1,
        _fontSizeFraction: 0.2,
    };

    static getDefaults(): Record<string, unknown> {
        return { ...super.getDefaults(), ...SingleLineText.ownDefaults };
    }

    declare private pathDataCache?: string;

    constructor(text: string, options?: Partial<ITextProps>) {
        super(text, { ...SingleLineText.ownDefaults, ...options });
    }

    /** Called by Fabric whenever text, font, size, spacing or alignment change. */
    initDimensions() {
        this.pathDataCache = undefined;
        super.initDimensions();
    }

    _measureChar(char: string, style: { fontFamily: string; fontSize: number }) {
        const width = glyphAdvance(getSingleLineFont(style.fontFamily), char, style.fontSize);
        return { width, kernedWidth: width };
    }

    _renderText(ctx: CanvasRenderingContext2D) {
        if (!this.stroke || !this.strokeWidth) return;

        ctx.save();
        this._setStrokeStyles(ctx, this);
        this._setLineDash(ctx, this.strokeDashArray);
        ctx.stroke(new Path2D(this.getPathData()));
        ctx.restore();
    }

    /** SVG path data for all glyphs, in the object's local (centre-origin) coordinates. */
    getPathData(): string {
        if (this.pathDataCache !== undefined) return this.pathDataCache;

        const font = getSingleLineFont(this.fontFamily);
        const left = this._getLeftOffset();
        const out: string[] = [];
        let lineTop = this._getTopOffset();

        this._textLines.forEach((line, lineIndex) => {
            const lineHeight = this.getHeightOfLine(lineIndex);
            // Same baseline Fabric uses: line box height minus the descent fraction.
            const baseline = lineTop + (lineHeight / this.lineHeight) * (1 - this._fontSizeFraction);
            const lineLeft = left + this._getLineLeftOffset(lineIndex);

            line.forEach((char, charIndex) => {
                const x = lineLeft + this.__charBounds[lineIndex][charIndex].left;
                appendGlyphPath(out, font, char, x, baseline, this.fontSize);
            });

            lineTop += lineHeight;
        });

        this.pathDataCache = out.join(" ");
        return this.pathDataCache;
    }

    _toSVG(): string[] {
        return ["<path ", "COMMON_PARTS", `d="${this.getPathData()}" />\n`];
    }

    toSVG(reviver?: SVGReviver): string {
        return this._createBaseSVGMarkup(this._toSVG(), { reviver });
    }

    /** Converts to a plain Fabric Path at the same position, e.g. for plotting. */
    toPath(): Path {
        const path = new Path(this.getPathData(), {
            stroke: this.stroke,
            strokeWidth: this.strokeWidth,
            strokeLineCap: this.strokeLineCap,
            strokeLineJoin: this.strokeLineJoin,
            fill: "",
            angle: this.angle,
            scaleX: this.scaleX,
            scaleY: this.scaleY,
            skewX: this.skewX,
            skewY: this.skewY,
            flipX: this.flipX,
            flipY: this.flipY,
        });

        // The path is centred on its own bounding box, which sits at pathOffset in our local space.
        const center = util.transformPoint(path.pathOffset, this.calcTransformMatrix());
        path.setPositionByOrigin(center, "center", "center");
        return path;
    }
}

classRegistry.setClass(SingleLineText);
