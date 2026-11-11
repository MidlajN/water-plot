import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Registration marks at the corners of the sheet: the app's signature, the same marks
 * the canvas draws around the page. Place inside a `relative` box the size of the sheet.
 */
export function RegistrationMarks({ offset = "-inset-2.5", className }: { offset?: string; className?: string }) {
    const mark = "absolute size-2.5 border-line-strong";
    return (
        <div aria-hidden className={cn("pointer-events-none absolute", offset, className)}>
            <span className={`${mark} top-0 left-0 border-t border-l`} />
            <span className={`${mark} top-0 right-0 border-t border-r`} />
            <span className={`${mark} bottom-0 left-0 border-b border-l`} />
            <span className={`${mark} right-0 bottom-0 border-r border-b`} />
        </div>
    );
}

/** A sheet of paper lying on the desk: sunken desk, soft paper shadow, corner marks. */
export function PaperOnDesk({ children, className, sheetClassName }: { children: ReactNode; className?: string; sheetClassName?: string }) {
    return (
        <div className={cn("rounded-control bg-surface-sunken p-4 sm:p-6", className)}>
            <div className={cn("relative", sheetClassName)}>
                <RegistrationMarks />
                {children}
            </div>
        </div>
    );
}
