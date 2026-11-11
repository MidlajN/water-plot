"use client";

import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "framer-motion";

import { usePlotter } from "../plotter/PlotterContext";

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-1";

export { focusRing };

/**
 * A sidebar section: a title (with optional trailing content) over its body.
 * A collapsible one starts folded and its title opens it.
 */
export function Section({
    title,
    aside,
    collapsible = false,
    children,
}: {
    title: string;
    aside?: ReactNode;
    collapsible?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(!collapsible);
    const bodyId = useId();

    return (
        <section aria-label={title} className="border-b border-separator px-5 py-4">
            <div className={`flex min-h-6 items-center justify-between gap-2 ${open ? "mb-3" : ""}`}>
                <h2 className="type-body font-semibold text-ink">
                    {collapsible ? (
                        <button
                            type="button"
                            aria-expanded={open}
                            aria-controls={bodyId}
                            onClick={() => setOpen((current) => !current)}
                            className={`-ml-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors hover:bg-ink/[0.05] ${focusRing}`}
                        >
                            <CaretRight
                                size={12}
                                weight="bold"
                                className={`text-graphite transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                            />
                            {title}
                        </button>
                    ) : (
                        title
                    )}
                </h2>
                {aside}
            </div>
            {collapsible ? (
                <div id={bodyId} hidden={!open}>
                    {children}
                </div>
            ) : (
                children
            )}
        </section>
    );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode };

/** Teal, full-width main action. */
export function PrimaryButton({ icon, children, className = "", ...props }: ButtonProps) {
    return (
        <button
            type="button"
            {...props}
            className={`press type-body flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal font-semibold text-on-accent hover:bg-teal-dark disabled:cursor-not-allowed disabled:bg-teal/35 ${focusRing} ${className}`}
        >
            {icon}
            {children}
        </button>
    );
}

/** Grey filled secondary action. */
export function SecondaryButton({ icon, children, className = "", ...props }: ButtonProps) {
    return (
        <button
            type="button"
            {...props}
            className={`press type-footnote flex h-10 items-center justify-center gap-2 rounded-xl bg-ink/[0.055] px-3.5 font-semibold text-ink hover:bg-ink/[0.08] disabled:cursor-not-allowed disabled:opacity-40 ${focusRing} ${className}`}
        >
            {icon}
            {children}
        </button>
    );
}

/** Plain teal text action. */
export function QuietButton({ icon, children, className = "", ...props }: ButtonProps) {
    return (
        <button
            type="button"
            {...props}
            className={`press type-footnote inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-semibold text-teal hover:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing} ${className}`}
        >
            {icon}
            {children}
        </button>
    );
}

/**
 * Segmented control: the selected segment's white pill glides to the new choice on a
 * critically damped spring. `kind="tab"` for mode tabs, otherwise radio buttons.
 */
export function Segmented<T extends string | number>({
    label,
    options,
    value,
    onChange,
    kind = "radio",
    className = "",
    itemClassName = "",
}: {
    label: string;
    options: ReadonlyArray<{ value: T; label: ReactNode; ariaLabel?: string }>;
    value: T;
    onChange: (value: T) => void;
    kind?: "radio" | "tab";
    className?: string;
    itemClassName?: string;
}) {
    const id = useId();
    const reduceMotion = useReducedMotion();

    return (
        <div role={kind === "tab" ? "tablist" : "radiogroup"} aria-label={label} className={`flex rounded-[0.625rem] bg-ink/[0.055] p-0.5 ${className}`}>
            {options.map((option) => {
                const selected = option.value === value;
                return (
                    <button
                        key={String(option.value)}
                        type="button"
                        role={kind}
                        aria-selected={kind === "tab" ? selected : undefined}
                        aria-checked={kind === "radio" ? selected : undefined}
                        aria-label={option.ariaLabel}
                        onClick={() => onChange(option.value)}
                        className={`press type-footnote relative flex h-8 flex-1 items-center justify-center rounded-lg px-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal ${
                            selected ? "text-ink" : "text-graphite hover:text-ink"
                        } ${itemClassName}`}
                    >
                        {selected && (
                            <motion.span
                                layoutId={`segment-${id}`}
                                aria-hidden
                                className="absolute inset-0 rounded-lg bg-surface-raised shadow-hairline"
                                transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.3 }}
                            />
                        )}
                        <span className="relative">{option.label}</span>
                    </button>
                );
            })}
        </div>
    );
}

/** Connection to the plotter, as a small tinted pill. */
export function ConnectionChip() {
    const { link, gatewayConnected } = usePlotter();

    const [label, tone] =
        link !== "online"
            ? [link === "connecting" ? "Connecting…" : "Reconnecting…", "bg-ink/[0.06] text-graphite before:bg-graphite"]
            : gatewayConnected
              ? ["Connected", "bg-ok/12 text-ok before:bg-ok"]
              : ["Plotter offline", "bg-fault/12 text-fault before:bg-fault"];

    return (
        <span
            role="status"
            className={`type-caption inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:content-[''] ${tone}`}
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
        <span className={`type-caption inline-flex items-center gap-1.5 font-semibold before:h-1.5 before:w-1.5 before:rounded-full before:content-[''] ${tone}`}>
            {label}
        </span>
    );
}

/** The app's mark: a single pen stroke on an accent tile. */
export function BrandMark({ className = "" }: { className?: string }) {
    return (
        <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-[8px] bg-accent text-on-accent shadow-hairline ${className}`}>
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 13.5c2.2-5.5 4.6-8 6-6.6 1.6 1.6-2.6 6.4-.8 7.6 1.6 1 4.2-3.2 5.6-2.4 1 .6.2 2.2 3.2 1.9" />
            </svg>
        </span>
    );
}
