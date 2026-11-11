import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Keyboard shortcut hint. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-surface-sunken px-1 font-sans text-micro font-medium text-muted", className)}>
            {children}
        </kbd>
    );
}
