import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import type { ConverterSettings } from "svg-to-gcode";

import { optimizeGcode, penStartPoint, type OptimizeOptions, type Point } from "./pathOptimizer";
import { convertSvgToGcode } from "./svgToGcode";

/** The plotter profile's heights: pen down at Z-4.5, up at Z-0.5. */
const SETTINGS: ConverterSettings = { zValue: -4.5, zOffset: 4, feedRate: 1400, tolerance: 0.3 };
const DOWN = "G0 Z-4.5";
const UP = "G0 Z-0.5";

const fmt = (value: number) => String(Number(value.toFixed(3)));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** G-code laid out as svg-to-gcode writes it, one pen-down run per stroke. */
function rawGcode(strokes: Point[][]): string {
    const lines = ["G1 F1400", "", "G0 Z0", "G90 G21"];
    for (const stroke of strokes) {
        lines.push(`G0 X${fmt(stroke[0].x)} Y${fmt(stroke[0].y)}`, "", DOWN);
        for (const p of stroke) lines.push(`G1 X${fmt(p.x)} Y${fmt(p.y)}`);
        lines.push("", UP);
    }
    return lines.join("\n");
}

interface Run {
    /** Pen-down segments, in drawing order. */
    segments: [Point, Point][];
    /** Points where the pen was down, including dots. */
    inked: Point[];
    lifts: number;
    travel: number;
    firstTravel: Point | null;
}

/** Plays G-code in svg-to-gcode's format, from `start`. */
function play(gcode: string, start: Point): Run {
    const run: Run = { segments: [], inked: [], lifts: 0, travel: 0, firstTravel: null };
    let pos = start;
    let down = false;
    for (const line of gcode.split("\n").map((l) => l.trim())) {
        if (line === DOWN) {
            down = true;
            run.inked.push(pos);
        } else if (line === UP) {
            if (down) run.lifts++;
            down = false;
        } else {
            const m = /^G([01]) X(\S+) Y(\S+)$/.exec(line);
            if (!m) continue;
            const next = { x: Number(m[2]), y: Number(m[3]) };
            if (down) {
                if (dist(pos, next) > 0) run.segments.push([pos, next]);
                run.inked.push(next);
            } else {
                run.travel += dist(pos, next);
                run.firstTravel ??= next;
            }
            pos = next;
        }
    }
    return run;
}

const key = (p: Point) => `${fmt(p.x)},${fmt(p.y)}`;
const segmentKey = ([a, b]: [Point, Point]) => [key(a), key(b)].sort().join(" ");

/** Small seeded PRNG, so failures reproduce. */
function random(seed: number) {
    return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 2 ** 32;
    };
}

/**
 * A messy drawing: open strokes, closed loops, near-closed loops, dots, and clusters of
 * strokes with ends close together, so bridging and rotation all get exercised.
 */
function randomDrawing(seed: number, count = 60): Point[][] {
    const rand = random(seed);
    const round = (p: Point) => ({ x: Number(p.x.toFixed(3)), y: Number(p.y.toFixed(3)) });
    const strokes: Point[][] = [];
    let anchor = { x: 50, y: 50 };
    for (let i = 0; i < count; i++) {
        if (rand() < 0.3) anchor = { x: rand() * 300, y: rand() * 200 };
        const at = { x: anchor.x + (rand() - 0.5) * 3, y: anchor.y + (rand() - 0.5) * 3 };
        const kind = rand();
        let points: Point[];
        if (kind < 0.1) {
            points = [at];
        } else if (kind < 0.45) {
            const r = 0.5 + rand() * 10;
            const sides = 3 + Math.floor(rand() * 20);
            points = Array.from({ length: sides }, (_, k) => ({
                x: at.x + r * Math.cos((2 * Math.PI * k) / sides),
                y: at.y + r * Math.sin((2 * Math.PI * k) / sides),
            }));
            // Exactly closed, or with a gap under 0.3 mm.
            points.push(rand() < 0.5 ? points[0] : { x: points[0].x + 0.15, y: points[0].y + 0.1 });
        } else {
            points = [at];
            for (let k = 0; k < 1 + Math.floor(rand() * 8); k++) {
                const last = points[points.length - 1];
                points.push({ x: last.x + (rand() - 0.5) * 8, y: last.y + (rand() - 0.5) * 8 });
            }
        }
        strokes.push(points.map(round));
    }
    return strokes;
}

function optimize(strokes: Point[][], options: Partial<OptimizeOptions> = {}) {
    const input = rawGcode(strokes);
    const result = optimizeGcode(input, { settings: SETTINGS, ...options });
    assert.equal(result.optimized, true, result.optimized ? "" : result.reason);
    return { input, result: result as Extract<typeof result, { optimized: true }> };
}

const CASES = [1, 2, 3, 4, 5, 6, 7, 8].flatMap((seed) =>
    [0, 0.5, 1, 3].flatMap((bridgeMm) => [null, { x: 0, y: 0 }, { x: 300, y: 200 }].map((start) => ({ seed, bridgeMm, start }))),
);

describe("optimizeGcode", () => {
    it("draws every original segment, in either direction, and every point", () => {
        for (const { seed, bridgeMm, start } of CASES) {
            const strokes = randomDrawing(seed);
            const { input, result } = optimize(strokes, { bridgeMm, start });
            const origin = start ?? strokes[0][0];
            const before = play(input, origin);
            const after = play(result.gcode, origin);

            const drawn = new Set(after.segments.map(segmentKey));
            for (const segment of before.segments) {
                assert.ok(drawn.has(segmentKey(segment)), `seed ${seed}: segment ${segmentKey(segment)} missing`);
            }
            const inked = new Set(after.inked.map(key));
            for (const p of before.inked) assert.ok(inked.has(key(p)), `seed ${seed}: point ${key(p)} not drawn`);
        }
    });

    it("never draws a new segment longer than bridgeMm, and adds none at 0", () => {
        for (const { seed, bridgeMm, start } of CASES) {
            const strokes = randomDrawing(seed);
            const { input, result } = optimize(strokes, { bridgeMm, start });
            const origin = start ?? strokes[0][0];
            const original = new Set(play(input, origin).segments.map(segmentKey));
            const added = play(result.gcode, origin).segments.filter((segment) => !original.has(segmentKey(segment)));

            if (bridgeMm === 0) assert.deepEqual(added, [], `seed ${seed}: lossless run added ink`);
            for (const [a, b] of added) {
                assert.ok(dist(a, b) <= bridgeMm + 1e-9, `seed ${seed}: ${dist(a, b)} mm bridge over ${bridgeMm} mm`);
            }
        }
    });

    it("never increases lifts or travel, and its stats match the program", () => {
        for (const { seed, bridgeMm, start } of CASES) {
            const strokes = randomDrawing(seed);
            const { input, result } = optimize(strokes, { bridgeMm, start });
            const origin = start ?? strokes[0][0];
            const before = play(input, origin);
            const after = play(result.gcode, origin);

            assert.ok(after.lifts <= before.lifts, `seed ${seed}: lifts ${before.lifts} → ${after.lifts}`);
            assert.ok(after.travel <= before.travel + 1e-6, `seed ${seed}: travel ${before.travel} → ${after.travel}`);
            assert.ok(result.time <= result.stats.timeBefore + 1e-6, `seed ${seed}: slower`);

            const { stats } = result;
            assert.equal(stats.liftsBefore, before.lifts);
            assert.equal(stats.liftsAfter, after.lifts);
            assert.ok(Math.abs(stats.travelBeforeMm - before.travel) < 1e-6);
            assert.ok(Math.abs(stats.travelAfterMm - after.travel) < 1e-6);
        }
    });

    it("bridges gaps up to bridgeMm and lifts over longer ones", () => {
        const strokes = [
            [{ x: 0, y: 0 }, { x: 10, y: 0 }],
            [{ x: 10.5, y: 0 }, { x: 20, y: 0 }],
            [{ x: 22, y: 0 }, { x: 30, y: 0 }],
        ];
        const { result } = optimize(strokes, { bridgeMm: 1, start: { x: 0, y: 0 } });
        assert.equal(result.stats.liftsAfter, 2);
        assert.equal(result.stats.bridges, 1);
        assert.match(result.gcode, /G1 X10 Y0\nG1 X10\.5 Y0\nG1 X20 Y0/);
    });

    it("keeps the header and writes numbers with at most 3 decimals", () => {
        const { result } = optimize([[{ x: 1.23456, y: 2 }, { x: 3, y: 4.0004 }]]);
        assert.ok(result.gcode.startsWith("G1 F1400\nG0 Z0\nG90 G21\n"));
        for (const n of result.gcode.match(/-?\d+\.\d+/g) ?? []) assert.ok(n.split(".")[1].length <= 3, n);
    });

    it("starts a closed loop at the vertex nearest the pen", () => {
        const square = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
            { x: 0, y: 0 },
        ];
        const start = { x: 10.2, y: 10.2 };
        const { input, result } = optimize([square], { bridgeMm: 0, start });
        const after = play(result.gcode, start);
        assert.deepEqual(after.firstTravel, { x: 10, y: 10 });
        assert.equal(after.segments.length, 4);
        const original = new Set(play(input, start).segments.map(segmentKey));
        for (const segment of after.segments) assert.ok(original.has(segmentKey(segment)));
        assert.ok(result.stats.travelAfterMm < 0.3);
    });

    it("rotates a loop with a small gap only when the gap may be bridged", () => {
        const almost = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 0, y: 10 },
            { x: 0, y: 0.2 },
        ];
        const start = { x: 10, y: 10 };

        const bridged = play(optimize([almost], { bridgeMm: 1, start }).result.gcode, start);
        assert.deepEqual(bridged.firstTravel, { x: 10, y: 10 });
        assert.equal(bridged.segments.length, 5); // The 0.2 mm gap is drawn.

        const lossless = play(optimize([almost], { bridgeMm: 0, start }).result.gcode, start);
        assert.equal(lossless.segments.length, 4);
        assert.ok(!lossless.segments.some(([a, b]) => segmentKey([a, b]) === "0,0 0,0.2"));
    });

    it("starts from the given point, or with the first stroke without one", () => {
        const far = [{ x: 100, y: 100 }, { x: 110, y: 100 }];
        const near = [{ x: 1, y: 1 }, { x: 5, y: 1 }];

        const fromPark = play(optimize([far, near], { start: { x: 0, y: 0 } }).result.gcode, { x: 0, y: 0 });
        assert.deepEqual(fromPark.firstTravel, { x: 1, y: 1 });

        const fromFirst = play(optimize([far, near], { start: null }).result.gcode, far[0]);
        assert.deepEqual(fromFirst.firstTravel, { x: 100, y: 100 });
    });

    it("maps the park position into pre-mirror space", () => {
        assert.equal(penStartPoint(null, 345), null);
        assert.deepEqual(penStartPoint({ x: 0, y: 0 }, null), { x: 0, y: 0 });
        assert.deepEqual(penStartPoint({ x: 10, y: 5 }, 345), { x: 680, y: 5 });

        // Mirrored about X = 345, a park at machine X = 0 sits at X = 690 before mirroring.
        const left = [{ x: 10, y: 10 }, { x: 20, y: 10 }];
        const right = [{ x: 680, y: 10 }, { x: 670, y: 10 }];
        const start = penStartPoint({ x: 0, y: 0 }, 345)!;
        const run = play(optimize([left, right], { start }).result.gcode, start);
        assert.deepEqual(run.firstTravel, { x: 680, y: 10 });
    });

    it("passes anything it doesn't understand through unchanged", () => {
        const good = rawGcode([[{ x: 0, y: 0 }, { x: 5, y: 5 }], [{ x: 9, y: 9 }, { x: 1, y: 1 }]]);
        const inputs: [string, string, ConverterSettings?][] = [
            ["relative mode", good.replace("G90 G21", "G91 G21")],
            ["G91 mid-program", good.replace("G1 X5 Y5", "G91\nG1 X5 Y5")],
            ["arc", good.replace("G1 X5 Y5", "G2 X5 Y5 I1 J0")],
            ["spindle", good.replace("G1 X5 Y5", "M3 S100\nG1 X5 Y5")],
            ["comment", good.replace("G1 X5 Y5", "G1 X5 Y5 ; edge")],
            ["feed mid-program", good.replace("G1 X5 Y5", "G1 X5 Y5 F900")],
            ["other pen height", good.replace(`\n${DOWN}`, "\nG0 Z-3")],
            ["G1 with the pen up", good.replace("G0 X9 Y9", "G1 X9 Y9")],
            ["ends pen down", good.slice(0, good.lastIndexOf(UP))],
            ["no strokes", "G1 F1400\nG0 Z0\nG90 G21"],
            ["not G-code", "hello"],
            ["empty", ""],
            ["other converter heights", good, { ...SETTINGS, zValue: -3 }],
            ["sortByArea", good, { ...SETTINGS, pathPlanning: "sortByArea" }],
        ];
        for (const [name, input, settings = SETTINGS] of inputs) {
            const result = optimizeGcode(input, { settings });
            assert.equal(result.optimized, false, name);
            assert.equal(result.gcode, input, name);
        }
    });

    it("orders thousands of strokes quickly", () => {
        const strokes = randomDrawing(42, 20000);
        const started = performance.now();
        const { result } = optimize(strokes, { start: { x: 0, y: 0 } });
        const ms = performance.now() - started;
        assert.ok(ms < 5000, `${ms} ms`);
        assert.ok(result.stats.travelAfterMm <= result.stats.travelBeforeMm);
    });
});

describe("convertSvgToGcode with the optimiser", () => {
    const ENV = ["PLOTTER_MIRROR", "PLOTTER_PARK", "PLOTTER_PARK_X", "PLOTTER_PARK_Y", "PLOTTER_OPTIMIZE", "PLOTTER_BRIDGE_MM", "PLOTTER_QUADRANT", "PLOTTER_X_OFFSET", "PLOTTER_Y_OFFSET"];
    const saved = Object.fromEntries(ENV.map((name) => [name, process.env[name]]));
    afterEach(() => {
        for (const name of ENV) {
            if (saved[name] === undefined) delete process.env[name];
            else process.env[name] = saved[name];
        }
    });
    const setEnv = (values: Record<string, string | undefined>) => {
        for (const name of ENV) delete process.env[name];
        Object.assign(process.env, values);
    };

    // 960 × 480 px = 254 × 127 mm. A line near each side, the right one listed first.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 480" width="960" height="480">
        <path d="M 940 100 L 900 100" stroke="black" fill="none"/>
        <path d="M 20 100 L 60 100" stroke="black" fill="none"/>
        <path d="M 20 300 L 60 300" stroke="black" fill="none"/>
    </svg>`;
    const firstTravelX = (gcode: string) => Number(/^G0 X(\S+) Y/m.exec(gcode)![1]);

    it("starts near the park position, mirrored or not", async () => {
        setEnv({ PLOTTER_PARK_X: "0", PLOTTER_PARK_Y: "0" });
        const plain = await convertSvgToGcode(svg, {}, { forPlotter: true });
        assert.ok(firstTravelX(plain.gcode) < 20, plain.gcode);
        assert.ok(plain.optimization);
        assert.ok(plain.optimization.travelAfterMm < plain.optimization.travelBeforeMm);

        // Mirrored, the right-hand line lands next to the park position at X = 0.
        setEnv({ PLOTTER_PARK_X: "0", PLOTTER_PARK_Y: "0", PLOTTER_MIRROR: "true" });
        const mirrored = await convertSvgToGcode(svg, {}, { forPlotter: true });
        assert.ok(firstTravelX(mirrored.gcode) < 20, mirrored.gcode);
    });

    it("leaves the converter's order with PLOTTER_OPTIMIZE=false", async () => {
        setEnv({ PLOTTER_OPTIMIZE: "false" });
        const result = await convertSvgToGcode(svg);
        assert.equal(result.optimization, undefined);
        assert.ok(firstTravelX(result.gcode) > 200, result.gcode);
    });
});
