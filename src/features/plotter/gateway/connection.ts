import { GatewayError, gatewaySocketUrl } from "./client";
import { parseGatewayEvent, type GatewayEvent, type GatewaySnapshot } from "./types";

const MIN_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 10_000;
/** Telemetry arrives every 200 ms; this long without any message means the link is dead. */
const SILENCE_LIMIT_MS = 3000;
/** Retry interval while GATEWAY_URL is unset. */
const UNCONFIGURED_RETRY_MS = 30_000;

export type ConnectionEvent = GatewayEvent | { type: "link"; data: { connected: boolean } };
type Listener = (event: ConnectionEvent) => void;

/**
 * One persistent WebSocket to the Pi gateway, shared by everything in this process.
 * Reconnects with exponential backoff and jitter, treats silence as a dead link, keeps
 * the latest telemetry/progress/completion, and fans events out to subscribers.
 */
class GatewayConnection {
    private socket: WebSocket | null = null;
    private listeners = new Set<Listener>();
    private attempts = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private watchdog: ReturnType<typeof setInterval> | null = null;
    private lastMessageAt = 0;
    private started = false;

    readonly snapshot: GatewaySnapshot = { connected: false, telemetry: null, progress: null, lastComplete: null };

    /** Connects on first use. */
    ensureStarted() {
        if (this.started) return;
        this.started = true;
        this.connect();
    }

    subscribe(listener: Listener): () => void {
        this.ensureStarted();
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private emit(event: ConnectionEvent) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error("[Gateway] Listener failed:", error);
            }
        }
    }

    private setConnected(connected: boolean) {
        if (this.snapshot.connected === connected) return;
        this.snapshot.connected = connected;
        if (!connected) this.snapshot.telemetry = null;
        this.emit({ type: "link", data: { connected } });
    }

    private connect() {
        let url: string;
        try {
            url = gatewaySocketUrl();
        } catch (error) {
            if (error instanceof GatewayError) console.warn(`[Gateway] ${error.message}`);
            this.reconnectTimer = setTimeout(() => this.connect(), UNCONFIGURED_RETRY_MS);
            return;
        }

        const socket = new WebSocket(url);
        this.socket = socket;

        socket.onopen = () => {
            this.attempts = 0;
            this.lastMessageAt = Date.now();
            this.setConnected(true);
            this.watchdog = setInterval(() => {
                if (Date.now() - this.lastMessageAt > SILENCE_LIMIT_MS) socket.close();
            }, 1000);
        };

        socket.onmessage = ({ data }) => {
            this.lastMessageAt = Date.now();
            const event = typeof data === "string" ? parseGatewayEvent(data) : null;
            if (!event) return;

            if (event.type === "telemetry") this.snapshot.telemetry = event.data;
            else if (event.type === "job_progress") this.snapshot.progress = event.data;
            else {
                this.snapshot.lastComplete = event.data;
                this.snapshot.progress = null;
            }
            this.emit(event);
        };

        // An error is always followed by close; reconnecting happens there.
        socket.onerror = () => {};

        socket.onclose = () => {
            if (this.socket !== socket) return;
            this.socket = null;
            if (this.watchdog) clearInterval(this.watchdog);
            this.watchdog = null;
            this.setConnected(false);
            this.scheduleReconnect();
        };
    }

    private scheduleReconnect() {
        const base = Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** this.attempts++);
        const delay = base / 2 + Math.random() * (base / 2);
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }
}

const globalForGateway = globalThis as typeof globalThis & { __plotterGateway?: GatewayConnection };

/** The process-wide gateway connection (kept across hot reloads). */
export function gatewayConnection(): GatewayConnection {
    globalForGateway.__plotterGateway ??= new GatewayConnection();
    globalForGateway.__plotterGateway.ensureStarted();
    return globalForGateway.__plotterGateway;
}
