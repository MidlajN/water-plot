#!/usr/bin/env node
/**
 * Mock Pi gateway for development: implements the REST + WebSocket contract from
 * NEXTJS_GATEWAY_STREAMING_PLAN.md without any hardware.
 *
 *   pnpm gateway:mock            (listens on :8080; PORT=… to change)
 *   LINES_PER_SECOND=200 pnpm gateway:mock
 *
 * REST:  POST /api/jobs/upload {name, gcode}   POST /api/jobs/start {job_id}
 *        POST /api/control/hold|resume|abort|jog   GET /api/status
 * WS:    /ws  telemetry every 200 ms, job_progress per line, job_complete
 *
 * It also warns about lines that break the pen safety rules (G0 Z moves, Z moves
 * faster than F1000, M400), so it doubles as a check of the app's G-code.
 */
import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8080);
const LINES_PER_SECOND = Number(process.env.LINES_PER_SECOND ?? 50);
const Z_FEED_MAX = 1000;
const TRAVEL_Z = -0.5;

const machine = { state: "Idle", mpos: [0, 0, TRAVEL_Z], feed: 0, mode: "G0" };
const jobs = new Map();
let active = null; // { job, line, startedAt, pausedAt, pausedTotal, timer }

const sockets = new Set();
function broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    for (const socket of sockets) if (socket.readyState === 1) socket.send(message);
}

function clean(gcode) {
    return gcode
        .split(/\r?\n/)
        .map((line) => line.replace(/\(.*?\)/g, "").replace(/;.*$/, "").trim())
        .filter(Boolean);
}

function safetyWarnings(lines) {
    const warnings = [];
    let modal = "G0";
    lines.forEach((line, index) => {
        const g = line.match(/\bG0*([01])\b/i);
        if (g) modal = `G${g[1]}`;
        const hasZ = /\bZ[-+]?[\d.]/i.test(line);
        const feed = Number(line.match(/\bF([\d.]+)/i)?.[1]);
        if (hasZ && modal === "G0") warnings.push(`line ${index + 1}: rapid Z move "${line}"`);
        if (hasZ && feed > Z_FEED_MAX) warnings.push(`line ${index + 1}: Z feed above F${Z_FEED_MAX} "${line}"`);
        if (/\bM0*400\b/i.test(line)) warnings.push(`line ${index + 1}: M400 is unsupported`);
    });
    return warnings;
}

function apply(line) {
    const g = line.match(/\bG0*([01])\b/i);
    if (g) machine.mode = `G${g[1]}`;
    const feed = line.match(/\bF([\d.]+)/i);
    if (feed) machine.feed = Number(feed[1]);
    ["X", "Y", "Z"].forEach((axis, index) => {
        const match = line.match(new RegExp(`\\b${axis}([-+]?[\\d.]+)`, "i"));
        if (match) machine.mpos[index] = Number(match[1]);
    });
}

function elapsed() {
    if (!active) return 0;
    const now = active.pausedAt ?? Date.now();
    return (now - active.startedAt - active.pausedTotal) / 1000;
}

function finish(status) {
    if (!active) return;
    clearInterval(active.timer);
    const { job } = active;
    job.status = status === "success" ? "completed" : status;
    broadcast("job_complete", { job_id: job.id, status, duration_seconds: Math.round(elapsed() * 10) / 10 });
    console.log(`[mock] ${job.id} ${status} after ${elapsed().toFixed(1)}s`);
    active = null;
    machine.state = "Idle";
    machine.mpos[2] = TRAVEL_Z; // park
}

function tick() {
    if (!active || active.pausedAt) return;
    const { job } = active;
    const line = job.lines[active.line];
    apply(line);
    active.line += 1;

    const done = active.line;
    const total = job.lines.length;
    const seconds = elapsed();
    broadcast("job_progress", {
        job_id: job.id,
        current_line: done,
        total_lines: total,
        percent: Math.round((done / total) * 10000) / 100,
        active_command: line,
        elapsed_seconds: Math.round(seconds * 10) / 10,
        estimated_remaining_seconds: Math.round(((seconds / done) * (total - done)) * 10) / 10,
    });

    if (done >= total) finish("success");
}

function readBody(req) {
    return new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => {
            try {
                resolve(data ? JSON.parse(data) : {});
            } catch {
                resolve(null);
            }
        });
    });
}

function reply(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

const routes = {
    "POST /api/jobs/upload": async (body) => {
        if (typeof body?.gcode !== "string") return [400, { error: "gcode is required" }];
        const lines = clean(body.gcode);
        if (lines.length === 0) return [400, { error: "no G-code lines" }];
        const id = `job_${Date.now()}`;
        jobs.set(id, { id, name: body.name ?? id, lines, status: "queued" });
        const warnings = safetyWarnings(lines);
        console.log(`[mock] uploaded ${id} "${body.name}" (${lines.length} lines)`);
        if (warnings.length) console.warn(`[mock] ${warnings.length} safety warnings:\n  ${warnings.slice(0, 10).join("\n  ")}`);
        else console.log("[mock] pen safety: ok");
        return [200, { job_id: id, lines_count: lines.length, status: "queued" }];
    },
    "POST /api/jobs/start": async (body) => {
        const job = jobs.get(body?.job_id);
        if (!job) return [404, { error: "unknown job_id" }];
        if (active) return [409, { error: "a job is already streaming" }];
        job.status = "streaming";
        machine.state = "Run";
        active = { job, line: 0, startedAt: Date.now(), pausedAt: null, pausedTotal: 0, timer: setInterval(tick, 1000 / LINES_PER_SECOND) };
        console.log(`[mock] streaming ${job.id}`);
        return [200, { status: "streaming" }];
    },
    "POST /api/control/hold": async () => {
        if (active && !active.pausedAt) {
            active.pausedAt = Date.now();
            active.job.status = "held";
        }
        machine.state = "Hold:0";
        return [200, { status: "held" }];
    },
    "POST /api/control/resume": async () => {
        if (active?.pausedAt) {
            active.pausedTotal += Date.now() - active.pausedAt;
            active.pausedAt = null;
            active.job.status = "streaming";
        }
        machine.state = active ? "Run" : "Idle";
        return [200, { status: "running" }];
    },
    "POST /api/control/abort": async () => {
        if (active) finish("aborted");
        machine.state = "Idle";
        return [200, { status: "aborted" }];
    },
    "POST /api/control/jog": async (body) => {
        if (active) return [409, { error: "busy" }];
        ["x", "y", "z"].forEach((axis, index) => {
            if (typeof body?.[axis] === "number") machine.mpos[index] += body[axis];
        });
        console.log(`[mock] jog ${JSON.stringify(body)}`);
        return [200, { status: "jogging" }];
    },
    "GET /api/status": async () => [
        200,
        {
            state: machine.state,
            mpos: machine.mpos,
            job: active
                ? { job_id: active.job.id, status: active.job.status, current_line: active.line, total_lines: active.job.lines.length }
                : null,
        },
    ],
};

const server = http.createServer(async (req, res) => {
    const route = routes[`${req.method} ${req.url?.split("?")[0]}`];
    if (!route) return reply(res, 404, { error: "not found" });
    const body = req.method === "POST" ? await readBody(req) : {};
    if (body === null) return reply(res, 400, { error: "invalid JSON" });
    const [status, payload] = await route(body);
    reply(res, status, payload);
});

const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (socket) => {
    sockets.add(socket);
    console.log(`[mock] ws client connected (${sockets.size})`);
    socket.on("close", () => sockets.delete(socket));
});

setInterval(() => {
    broadcast("telemetry", {
        state: machine.state,
        mpos: machine.mpos.map((value) => Math.round(value * 100) / 100),
        feed: machine.state === "Run" ? machine.feed : 0,
        buffer_free: active && !active.pausedAt ? 12 : 15,
    });
}, 200);

server.listen(PORT, () => console.log(`[mock] Pi gateway mock on http://localhost:${PORT} (ws://localhost:${PORT}/ws)`));
