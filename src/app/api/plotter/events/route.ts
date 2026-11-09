import { connection } from "next/server";

import { gatewayConnection, type ConnectionEvent } from "@/features/plotter/gateway/connection";

const KEEPALIVE_MS = 15_000;

/**
 * GET /api/plotter/events: live plotter events as Server-Sent Events.
 *
 * Starts with a `snapshot` event ({ connected, telemetry, progress, lastComplete }),
 * then relays the gateway's `telemetry`, `job_progress` and `job_complete` events
 * plus `link` ({ connected }) whenever the gateway connection drops or returns.
 */
export async function GET(request: Request) {
    await connection();

    const gateway = gatewayConnection();
    const encoder = new TextEncoder();
    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            const send = (type: string, data: unknown) => {
                try {
                    controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`));
                } catch {
                    cleanup();
                }
            };

            send("snapshot", gateway.snapshot);
            const unsubscribe = gateway.subscribe((event: ConnectionEvent) => send(event.type, event.data));
            const keepalive = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(": ping\n\n"));
                } catch {
                    cleanup();
                }
            }, KEEPALIVE_MS);

            cleanup = () => {
                unsubscribe();
                clearInterval(keepalive);
                try {
                    controller.close();
                } catch {
                    // Already closed.
                }
            };
            request.signal.addEventListener("abort", () => cleanup());
        },
        cancel() {
            cleanup();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-store, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
