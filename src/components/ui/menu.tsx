"use client";

import type { ComponentProps, ReactNode } from "react";
import { DropdownMenu } from "radix-ui";
import { Check } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

/**
 * Menus on Radix DropdownMenu: focus management, typeahead, Escape and outside-click
 * handling, and portals (so menus are never clipped by an overflow container).
 */
export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuGroup = DropdownMenu.Group;
export const MenuRadioGroup = DropdownMenu.RadioGroup;

const surface = [
    "z-50 min-w-48 overflow-hidden rounded-[12px] border border-line p-1 text-ui text-text shadow-overlay glass",
    "origin-(--radix-dropdown-menu-content-transform-origin)",
    "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97]",
    "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
    "data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
].join(" ");

export function MenuContent({ className, sideOffset = 6, align = "end", ...props }: ComponentProps<typeof DropdownMenu.Content>) {
    return (
        <DropdownMenu.Portal>
            <DropdownMenu.Content sideOffset={sideOffset} align={align} collisionPadding={12} className={cn(surface, className)} {...props} />
        </DropdownMenu.Portal>
    );
}

const item = [
    "relative flex h-9 cursor-default select-none items-center gap-2.5 rounded-[8px] px-2.5 outline-none",
    "data-highlighted:bg-surface-hover data-disabled:pointer-events-none data-disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted",
].join(" ");

interface MenuItemProps extends ComponentProps<typeof DropdownMenu.Item> {
    icon?: ReactNode;
    shortcut?: ReactNode;
    tone?: "default" | "danger";
}

export function MenuItem({ icon, shortcut, tone = "default", className, children, ...props }: MenuItemProps) {
    return (
        <DropdownMenu.Item className={cn(item, tone === "danger" && "text-danger [&_svg]:text-danger", className)} {...props}>
            {icon}
            <span className="flex-1 truncate">{children}</span>
            {shortcut && <span className="text-caption text-subtle">{shortcut}</span>}
        </DropdownMenu.Item>
    );
}

export function MenuRadioItem({ className, children, ...props }: ComponentProps<typeof DropdownMenu.RadioItem>) {
    return (
        <DropdownMenu.RadioItem className={cn(item, "pr-8", className)} {...props}>
            {children}
            <DropdownMenu.ItemIndicator className="absolute right-2.5 inline-flex">
                <Check weight="bold" className="!text-accent" />
            </DropdownMenu.ItemIndicator>
        </DropdownMenu.RadioItem>
    );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
    return <DropdownMenu.Label className={cn("px-2.5 pt-2 pb-1 text-micro font-semibold text-subtle", className)} {...props} />;
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenu.Separator>) {
    return <DropdownMenu.Separator className={cn("mx-1 my-1 h-px bg-line", className)} {...props} />;
}
