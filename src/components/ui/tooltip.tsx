"use client";

import type { ReactNode } from "react";
import { Tooltip as RadixTooltip } from "radix-ui";

import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";

/** Mount once near the root so tooltips share one delay timer. */
export function TooltipProvider({ children }: { children: ReactNode }) {
    return (
        <RadixTooltip.Provider delayDuration={450} skipDelayDuration={250}>
            {children}
        </RadixTooltip.Provider>
    );
}

interface TooltipProps {
    label: ReactNode;
    shortcut?: string;
    side?: "top" | "right" | "bottom" | "left";
    children: ReactNode;
}

/** Hover/focus label for icon-only controls. The trigger still needs an aria-label. */
export function Tooltip({ label, shortcut, side = "top", children }: TooltipProps) {
    return (
        <RadixTooltip.Root>
            <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
            <RadixTooltip.Portal>
                <RadixTooltip.Content
                    side={side}
                    sideOffset={8}
                    collisionPadding={8}
                    className={cn(
                        "z-50 flex items-center gap-2 rounded-[8px] bg-text px-2.5 py-1.5 text-caption font-medium text-bg shadow-raised",
                        "data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-[0.97]",
                        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
                    )}
                >
                    {label}
                    {shortcut && <Kbd className="border-transparent bg-[color-mix(in_oklch,var(--bg),transparent_80%)] text-bg">{shortcut}</Kbd>}
                </RadixTooltip.Content>
            </RadixTooltip.Portal>
        </RadixTooltip.Root>
    );
}
