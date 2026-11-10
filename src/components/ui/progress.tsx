import { cn } from "@/lib/utils";

interface ProgressProps {
    /** 0–100. */
    value: number;
    tone?: "accent" | "danger" | "warn";
    label: string;
    className?: string;
}

/** Thin progress track; the bar eases to each new value. */
export function Progress({ value, tone = "accent", label, className }: ProgressProps) {
    const clamped = Math.max(0, Math.min(100, value));
    return (
        <div
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clamped)}
            className={cn("h-1.5 overflow-hidden rounded-full bg-surface-sunken", className)}
        >
            <div
                className={cn(
                    "h-full origin-left rounded-full transition-transform duration-500 ease-out-quint",
                    tone === "danger" ? "bg-danger" : tone === "warn" ? "bg-warn" : "bg-accent",
                )}
                style={{ transform: `scaleX(${clamped / 100})` }}
            />
        </div>
    );
}
