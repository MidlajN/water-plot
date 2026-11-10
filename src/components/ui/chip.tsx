import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

interface ChipProps extends ComponentProps<"button"> {
    /** Selected look. Pass aria-pressed or aria-checked yourself for the right semantics. */
    selected?: boolean;
    size?: "sm" | "md";
}

/** Rounded choice or suggestion chip. */
export function Chip({ selected = false, size = "md", className, type = "button", ...props }: ChipProps) {
    return (
        <button
            type={type}
            data-selected={selected || undefined}
            className={cn(
                "focus-ring inline-flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
                "transition-[background-color,border-color,color] duration-150 active:not-disabled:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:size-3.5",
                size === "sm" ? "h-7 px-2.5 text-caption" : "h-8 px-3 text-ui",
                selected
                    ? "border-accent-line bg-accent-soft text-accent"
                    : "border-line bg-surface-raised text-muted hover:not-disabled:border-line-strong hover:not-disabled:text-text dark:border-line-strong dark:bg-transparent",
                className,
            )}
            {...props}
        />
    );
}
