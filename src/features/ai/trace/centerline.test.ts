import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { PNG } from "pngjs";

import { TraceError, simplify, traceCenterlines } from "./centerline";
import { decodeToGray, downscale, sniffImage, type GrayImage } from "./decode";

/** A white canvas with drawing helpers that paint black discs (a round pen). */
function canvas(width = 400, height = 400) {
    const data = new Uint8Array(width * height).fill(255);
    const disc = (cx: number, cy: number, r: number) => {
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
            for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
                if (x >= 0 && y >= 0 && x < width && y < height && (x - cx) ** 2 + (y - cy) ** 2 <= r * r) data[y * width + x] = 0;
            }
        }
    };
    const line = (x0: number, y0: number, x1: number, y1: number, thickness: number) => {
        const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
        for (let i = 0; i <= steps; i++) disc(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, thickness / 2);
    };
    const ring = (cx: number, cy: number, radius: number, thickness: number) => {
        const steps = Math.ceil(2 * Math.PI * radius);
        for (let i = 0; i < steps; i++) {
            const a = (i / steps) * 2 * Math.PI;
            disc(cx + radius * Math.cos(a), cy + radius * Math.sin(a), thickness / 2);
        }
    };
    const image: GrayImage = { width, height, data };
    return { image, disc, line, ring };
}

const subpaths = (svg: string) => [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) => match[1]);

describe("traceCenterlines", () => {
    it("traces a thick ring as one closed stroke", () => {
        const { image, ring } = canvas();
        ring(200, 200, 120, 9);
        const result = traceCenterlines(image);
        assert.equal(result.strokes, 1);
        assert.match(subpaths(result.svg)[0], /Z$/);
        assert.ok(result.lineWidth > 6 && result.lineWidth < 12, `line width ${result.lineWidth}`);
    });

    it("traces a thick straight line as one open stroke near its centre", () => {
        const { image, line } = canvas();
        line(50, 200, 350, 200, 10);
        const result = traceCenterlines(image);
        assert.equal(result.strokes, 1);
        const d = subpaths(result.svg)[0];
        assert.doesNotMatch(d, /Z$/);
        const numbers = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        const ys = numbers.filter((_, i) => i % 2 === 1);
        for (const y of ys) assert.ok(Math.abs(y - 200) < 2.5, `y ${y} strays from the centreline`);
    });

    it("keeps lines unbroken through a crossing", () => {
        const { image, line } = canvas();
        line(60, 60, 340, 340, 8);
        line(60, 340, 340, 60, 8);
        const result = traceCenterlines(image);
        assert.ok(result.strokes <= 2, `${result.strokes} strokes`);
    });

    it("drops specks but keeps dots", () => {
        const { image, line, disc } = canvas();
        line(50, 300, 350, 300, 8);
        disc(200, 100, 6); // an eye
        for (let i = 0; i < 20; i++) disc(20 + i * 17, 20, 1); // JPEG-like speckle
        const result = traceCenterlines(image);
        assert.equal(result.strokes, 2);
    });

    it("refuses a blank image", () => {
        const { image } = canvas();
        assert.throws(() => traceCenterlines(image), TraceError);
    });

    it("works on white-on-black drawings", () => {
        const { image, ring } = canvas();
        ring(200, 200, 100, 9);
        for (let i = 0; i < image.data.length; i++) image.data[i] = 255 - image.data[i];
        assert.equal(traceCenterlines(image).strokes, 1);
    });

    it("stays within the path budget", () => {
        const { image, ring } = canvas(800, 800);
        for (let x = 40; x < 800; x += 50) for (let y = 40; y < 800; y += 50) ring(x, y, 18, 4);
        const result = traceCenterlines(image, { maxPathChars: 6000 });
        assert.ok(result.pathChars <= 6000, `${result.pathChars} chars`);
        assert.ok(result.strokes > 0);
    });
});

describe("simplify", () => {
    it("keeps the ends and the corner of an L", () => {
        const points: [number, number][] = [];
        for (let i = 0; i <= 10; i++) points.push([i, 0]);
        for (let i = 1; i <= 10; i++) points.push([10, i]);
        assert.deepEqual(simplify(points, 0.5), [
            [0, 0],
            [10, 0],
            [10, 10],
        ]);
    });
});

describe("decode", () => {
    it("reads a PNG and composites transparency over white", () => {
        const png = new PNG({ width: 2, height: 1 });
        png.data.set([0, 0, 0, 255, 0, 0, 0, 0]); // opaque black, transparent black
        const bytes = new Uint8Array(PNG.sync.write(png));
        assert.equal(sniffImage(bytes), "png");
        const gray = decodeToGray(bytes);
        assert.deepEqual([...gray.data], [0, 255]);
    });

    it("downscales to the longest side", () => {
        const image: GrayImage = { width: 1000, height: 500, data: new Uint8Array(500_000).fill(200) };
        const small = downscale(image, 800);
        assert.equal(small.width, 800);
        assert.equal(small.height, 400);
        assert.equal(small.data[0], 200);
    });
});
