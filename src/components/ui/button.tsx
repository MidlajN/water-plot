import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

/**
 * The one button. Primary is the single main action of a region; secondary for the
 * rest; ghost for toolbars and low-emphasis actions; danger for destructive ones.
 */
export const buttonVariants = cva(
    [
        "focus-ring relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap font-medium",
        "transition-[background-color,color,box-shadow,transform,opacity] duration-150 ease-out-cubic",
        "active:not-disabled:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    ],
    {
        variants: {
            variant: {
                primary: "bg-accent text-on-accent shadow-hairline hover:not-disabled:bg-accent-hover",
                secondary: "bg-surface-raised text-text shadow-hairline hover:not-disabled:bg-surface-hover",
                ghost: "text-muted hover:not-disabled:bg-surface-hover hover:not-disabled:text-text aria-pressed:bg-accent-soft aria-pressed:text-accent aria-expanded:bg-surface-hover aria-expanded:text-text",
                danger: "bg-danger-soft text-danger hover:not-disabled:bg-[color-mix(in_oklch,var(--danger-soft),var(--danger)_14%)]",
                "danger-solid": "bg-danger text-white shadow-hairline hover:not-disabled:brightness-105 dark:text-[oklch(0.17_0.03_25)]",
            },
            size: {
                sm: "h-8 rounded-[9px] px-3 text-caption [&_svg]:size-3.5",
                md: "h-9 rounded-control px-3.5 text-ui [&_svg]:size-4",
                lg: "h-11 rounded-[12px] px-5 text-body [&_svg]:size-[18px]",
                "icon-sm": "size-8 rounded-[9px] [&_svg]:size-4",
                icon: "size-9 rounded-control [&_svg]:size-[18px]",
                "icon-lg": "size-11 rounded-[12px] [&_svg]:size-5",
            },
            block: { true: "w-full" },
        },
        defaultVariants: { variant: "secondary", size: "md" },
    },
);

export interface ButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
    /** Shows a spinner, keeps the width, and blocks clicks. */
    busy?: boolean;
}

export function Button({ className, variant, size, block, busy = false, disabled, children, type = "button", ...props }: ButtonProps) {
    return (
        <button
            type={type}
            data-busy={busy || undefined}
            aria-busy={busy || undefined}
            disabled={disabled || busy}
            className={cn(buttonVariants({ variant, size, block }), busy && "disabled:opacity-100", className)}
            {...props}
        >
            {busy ? (
                <>
                    <span className="invisible inline-flex items-center gap-2">{children}</span>
                    <Spinner className="absolute" />
                </>
            ) : (
                children
            )}
        </button>
    );
}
