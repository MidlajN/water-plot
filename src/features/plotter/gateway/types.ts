/**
 * Contract of the Pi gateway (REST on :8080/api, WebSocket on :8080/ws), per
 * NEXTJS_GATEWAY_STREAMING_PLAN.md. Field names match the wire format.
 */

/** FluidNC state, e.g. "Idle", "Run", "Hold:0", "Alarm", "Home", "Jog". */
export type MachineState = string;

export type Position = [x: number, y: number, z: number];

export interface Telemetry {
    state: MachineState;
    mpos: Position;
    feed: number;
    buffer_free: number;
}

export interface JobProgress {
    job_id: string;
    current_line: number;
    total_lines: number;
    percent: number;
    active_command: string;
    elapsed_seconds: number;
    estimated_remaining_seconds: number;
}

/** The spec only shows "success"; other values (e.g. "aborted", "failed") are treated as not successful. */
export interface JobComplete {
    job_id: string;
    status: "success" | "aborted" | "failed" | (string & {});
    duration_seconds: number;
}

export type GatewayEvent =
    | { type: "telemetry"; data: Telemetry }
    | { type: "job_progress"; data: JobProgress }
    | { type: "job_complete"; data: JobComplete };

/** The spec leaves the job shape open; these are the fields used when present. */
export interface GatewayJob {
    job_id: string;
    status?: string;
    current_line?: number;
    total_lines?: number;
}

export interface GatewayStatus {
    state: MachineState;
    mpos: Position;
    job: GatewayJob | null;
}

export interface UploadResult {
    job_id: string;
    lines_count: number;
    status: string;
}

export interface JogRequest {
    x?: number;
    y?: number;
    z?: number;
    feed: number;
}

/** What the app keeps of the live gateway connection. */
export interface GatewaySnapshot {
    connected: boolean;
    telemetry: Telemetry | null;
    progress: JobProgress | null;
    lastComplete: JobComplete | null;
}

const ACTIVE_JOB_STATUSES = new Set(["queued", "streaming", "running", "held"]);

/** Whether the machine can take a new job. */
export function isMachineBusy(status: GatewayStatus): boolean {
    const jobActive = status.job ? ACTIVE_JOB_STATUSES.has(status.job.status ?? "streaming") : false;
    return status.state !== "Idle" || jobActive;
}

export function parseGatewayEvent(raw: string): GatewayEvent | null {
    try {
        const message = JSON.parse(raw);
        if (
            message &&
            typeof message === "object" &&
            ["telemetry", "job_progress", "job_complete"].includes(message.type) &&
            message.data &&
            typeof message.data === "object"
        ) {
            return message as GatewayEvent;
        }
    } catch {
        // Not JSON; ignore.
    }
    return null;
}
