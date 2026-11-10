"use client";

import { StatusPill, type Tone } from "@/components/ui/status";
import { usePlotter } from "../plotter/PlotterContext";

/** App mark: a single plotted stroke on the accent tile. */
export function BrandMark({ className = "" }: { className?: string }) {
    return (
        <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-[8px] bg-accent text-on-accent shadow-hairline ${className}`}>
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 13.5c2.2-5.5 4.6-8 6-6.6 1.6 1.6-2.6 6.4-.8 7.6 1.6 1 4.2-3.2 5.6-2.4 1 .6.2 2.2 3.2 1.9" />
            </svg>
        </span>
    );
}

/** Connection to the plotter, as a small tinted pill. */
export function ConnectionChip() {
    const { link, gatewayConnected } = usePlotter();

    const [label, tone]: [string, Tone] =
        link !== "online"
            ? [link === "connecting" ? "Connecting…" : "Reconnecting…", "neutral"]
            : gatewayConnected
              ? ["Connected", "ok"]
              : ["Plotter offline", "danger"];

    return (
        <StatusPill role="status" tone={tone} live={link !== "online"}>
            {label}
        </StatusPill>
    );
}

/** FluidNC state as a word with its colour. */
export function MachineStateChip() {
    const { telemetry, gatewayConnected } = usePlotter();
    const state = gatewayConnected ? telemetry?.state : undefined;

    const [label, tone]: [string, Tone] = !state
        ? ["No signal", "neutral"]
        : state === "Idle"
          ? ["Idle", "ok"]
          : state === "Run"
            ? ["Running", "accent"]
            : state.startsWith("Hold")
              ? ["On hold", "warn"]
              : state === "Alarm"
                ? ["Alarm", "danger"]
                : [state, "neutral"];

    return (
        <StatusPill tone={tone} live={state === "Run"}>
            {label}
        </StatusPill>
    );
}
