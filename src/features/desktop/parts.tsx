"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

import { usePlotter } from "../plotter/PlotterContext";

/** A sidebar section: a plain title (with optional trailing content) over its body. */
export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
    return (
        <section aria-label={title} className="border-b border-rule px-5 py-4">
            <div className="mb-3 flex min-h-6 items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink">{title}</h2>
                {aside}
            </div>
            {children}
        </section>
    );
}

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode };

/** Teal, full-width main action. */
export function PrimaryButton({ icon, children, className = "", ...props }: ButtonProps) {
    return (
        <button
            type="button"
            {...props}
            className={`flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal text-[13px] font-medium text-white transition-colors hover:bg-teal-dark disabled:cursor-not-allowed disabled:bg-teal/40 ${focusRing} ${className}`}
        >
            {icon}
            {children}
        </button>
    );
}

/** Outlined secondary action. */
export function SecondaryButton({ icon, children, className = "", ...props }: ButtonProps) {
    return (
        <button
            type="button"
            {...props}
            className={`flex h-9 items-center justify-center gap-2 rounded-lg border border-rule bg-white px-3 text-[13px] font-medium text-ink transition-colors hover:bg-desk disabled:cursor-not-allowed disabled:opacity-45 ${focusRing} ${className}`}
        >
            {icon}
            {children}
        </button>
    );
}

/** Quiet text action. */
export function QuietButton({ icon, children, className = "", ...props }: ButtonProps) {
    return (
        <button
            type="button"
            {...props}
            className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-graphite transition-colors hover:bg-desk hover:text-ink disabled:cursor-not-allowed disabled:opacity-45 ${focusRing} ${className}`}
        >
            {icon}
            {children}
        </button>
    );
}

export { focusRing };

/** Connection to the plotter, as a small tinted pill. */
export function ConnectionChip() {
    const { link, gatewayConnected } = usePlotter();

    const [label, tone] =
        link !== "online"
            ? [link === "connecting" ? "Connecting…" : "Reconnecting…", "bg-desk text-graphite before:bg-graphite"]
            : gatewayConnected
              ? ["Connected", "bg-ok/10 text-ok before:bg-ok"]
              : ["Plotter offline", "bg-fault/10 text-fault before:bg-fault"];

    return (
        <span
            role="status"
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium before:h-1.5 before:w-1.5 before:rounded-full before:content-[''] ${tone}`}
        >
            {label}
        </span>
    );
}

/** FluidNC state as a word with its colour. */
export function MachineStateChip() {
    const { telemetry, gatewayConnected } = usePlotter();
    const state = gatewayConnected ? telemetry?.state : undefined;

    const [label, tone] = !state
        ? ["No signal", "text-graphite before:bg-graphite/50"]
        : state === "Idle"
          ? ["Idle", "text-ok before:bg-ok"]
          : state === "Run"
            ? ["Running", "text-teal before:bg-teal"]
            : state.startsWith("Hold")
              ? ["On hold", "text-caution before:bg-caution"]
              : state === "Alarm"
                ? ["Alarm", "text-fault before:bg-fault"]
                : [state, "text-ink before:bg-graphite"];

    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium before:h-1.5 before:w-1.5 before:rounded-full before:content-[''] ${tone}`}>
            {label}
        </span>
    );
}
