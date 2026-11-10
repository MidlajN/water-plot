import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";

const DOT: Record<Tone, string> = {
    neutral: "bg-subtle",
    accent: "bg-accent",
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
};

const PILL: Record<Tone, string> = {
    neutral: "bg-surface-sunken text-muted",
    accent: "bg-accent-soft text-accent",
    ok: "bg-ok-soft text-ok",
    warn: "bg-warn-soft text-[color-mix(in_oklch,var(--warn),var(--text)_35%)]",
    danger: "bg-danger-soft text-danger",
};

/** A status dot. `live` adds a soft pulse for "working right now". */
export function StatusDot({ tone = "neutral", live = false, className }: { tone?: Tone; live?: boolean; className?: string }) {
    return (
        <span aria-hidden className={cn("relative inline-flex size-2 shrink-0", className)}>
            {live && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-50 [animation-duration:1.6s]", DOT[tone])} />}
            <span className={cn("relative size-2 rounded-full", DOT[tone])} />
        </span>
    );
}

/** Compact state label: dot + text on a tinted ground. */
export function StatusPill({ tone = "neutral", live = false, children, className, role }: { tone?: Tone; live?: boolean; children: ReactNode; className?: string; role?: "status" }) {
    return (
        <span role={role} className={cn("inline-flex h-6 items-center gap-1.5 rounded-full pr-2.5 pl-2 text-caption font-medium whitespace-nowrap", PILL[tone], className)}>
            <StatusDot tone={tone} live={live} />
            {children}
        </span>
    );
}
