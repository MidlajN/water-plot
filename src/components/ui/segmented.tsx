"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "framer-motion";

import { SPRING_SNAPPY } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
    value: T;
    label: ReactNode;
    icon?: ReactNode;
    /** Accessible name when the label is icon-only. */
    ariaLabel?: string;
    disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
    options: readonly SegmentOption<T>[];
    value: T;
    onChange: (value: T) => void;
    "aria-label": string;
    /** "tabs" for views (tablist/tab), "radio" for settings (radiogroup/radio). */
    semantics?: "tabs" | "radio";
    size?: "sm" | "md";
    block?: boolean;
    className?: string;
}

/**
 * Segmented control with a sliding selection indicator. Arrow keys move between
 * segments (roving tab stop), matching native segmented controls.
 */
export function SegmentedControl<T extends string>({
    options,
    value,
    onChange,
    semantics = "tabs",
    size = "md",
    block = false,
    className,
    ...aria
}: SegmentedControlProps<T>) {
    const indicatorId = useId();
    const refs = useRef<(HTMLButtonElement | null)[]>([]);
    const tabs = semantics === "tabs";

    const move = (event: KeyboardEvent, index: number) => {
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
        if (!step && event.key !== "Home" && event.key !== "End") return;
        event.preventDefault();
        const enabled = options.map((option, i) => (option.disabled ? -1 : i)).filter((i) => i >= 0);
        let next: number;
        if (event.key === "Home") next = enabled[0];
        else if (event.key === "End") next = enabled[enabled.length - 1];
        else {
            const at = enabled.indexOf(index);
            next = enabled[(at + step + enabled.length) % enabled.length];
        }
        onChange(options[next].value);
        refs.current[next]?.focus();
    };

    return (
        <div
            role={tabs ? "tablist" : "radiogroup"}
            aria-label={aria["aria-label"]}
            className={cn(
                "relative isolate inline-flex rounded-control bg-surface-sunken p-[3px]",
                block && "flex w-full",
                className,
            )}
        >
            {options.map((option, index) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        ref={(node) => {
                            refs.current[index] = node;
                        }}
                        type="button"
                        role={tabs ? "tab" : "radio"}
                        aria-selected={tabs ? selected : undefined}
                        aria-checked={tabs ? undefined : selected}
                        aria-label={option.ariaLabel}
                        tabIndex={selected ? 0 : -1}
                        disabled={option.disabled}
                        onClick={() => onChange(option.value)}
                        onKeyDown={(event) => move(event, index)}
                        className={cn(
                            "focus-ring relative inline-flex flex-1 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] font-medium",
                            "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:shrink-0",
                            size === "sm" ? "h-7 px-2.5 text-caption [&_svg]:size-3.5" : "h-8 px-3 text-ui [&_svg]:size-4",
                            selected ? "text-text" : "text-muted hover:not-disabled:text-text",
                        )}
                    >
                        {selected && (
                            <motion.span
                                layoutId={indicatorId}
                                transition={SPRING_SNAPPY}
                                aria-hidden
                                className="absolute inset-0 -z-10 rounded-[8px] bg-surface-raised shadow-hairline dark:bg-surface-pressed"
                            />
                        )}
                        {option.icon}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
