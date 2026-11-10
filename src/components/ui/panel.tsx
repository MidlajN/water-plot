import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SectionProps extends Omit<ComponentProps<"section">, "title"> {
    title: ReactNode;
    /** Right side of the header: a status pill or a small action. */
    aside?: ReactNode;
}

/** A labelled region of a sidebar or panel, separated by a hairline. */
export function Section({ title, aside, className, children, ...props }: SectionProps) {
    return (
        <section className={cn("border-t border-line px-5 pt-4 pb-5 first:border-t-0", className)} {...props}>
            <header className="mb-3 flex min-h-6 items-center justify-between gap-3">
                <h2 className="text-caption font-semibold tracking-[0.01em] text-muted">{title}</h2>
                {aside}
            </header>
            {children}
        </section>
    );
}

/** A raised container for one coherent object (a design, the current plot). Never nest. */
export function Card({ className, ...props }: ComponentProps<"div">) {
    return <div className={cn("rounded-panel bg-surface-raised shadow-raised", className)} {...props} />;
}
