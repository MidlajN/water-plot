"use client";

import type { ComponentProps } from "react";
import { Popover as RadixPopover } from "radix-ui";

import { cn } from "@/lib/utils";

/** Non-modal floating panel anchored to a trigger (pickers, flyouts). */
export const Popover = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;
export const PopoverAnchor = RadixPopover.Anchor;
export const PopoverClose = RadixPopover.Close;

export function PopoverContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof RadixPopover.Content>) {
    return (
        <RadixPopover.Portal>
            <RadixPopover.Content
                sideOffset={sideOffset}
                collisionPadding={12}
                className={cn(
                    "z-50 rounded-panel border border-line p-3 text-ui text-text shadow-overlay glass outline-none",
                    "origin-(--radix-popover-content-transform-origin)",
                    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97]",
                    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
                    className,
                )}
                {...props}
            />
        </RadixPopover.Portal>
    );
}
