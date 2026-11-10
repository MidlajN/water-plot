import { useId, type ComponentProps, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/utils";

const control = [
    "focus-ring w-full rounded-control border border-line bg-surface-raised text-text shadow-[inset_0_1px_0_oklch(0_0_0/0.02)]",
    "transition-[border-color,box-shadow] duration-150 hover:not-disabled:border-line-strong",
    "focus-visible:border-accent-line disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
].join(" ");

/** Phones zoom into inputs under 16px, so controls use text-base below md. */
const sizing = "text-base md:text-ui";

export function Input({ className, ...props }: ComponentProps<"input">) {
    return <input className={cn(control, sizing, "h-9 px-3", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
    return <textarea className={cn(control, sizing, "min-h-20 resize-none px-3 py-2.5 leading-relaxed", className)} {...props} />;
}

/** Native select (best on touch), styled to match. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
    return (
        <span className="relative block">
            <select className={cn(control, sizing, "h-9 appearance-none pr-9 pl-3", className)} {...props}>
                {children}
            </select>
            <CaretDown aria-hidden weight="bold" className="pointer-events-none absolute top-1/2 right-3 size-3.5 -translate-y-1/2 text-subtle" />
        </span>
    );
}

interface FieldProps {
    label: ReactNode;
    hint?: ReactNode;
    error?: ReactNode;
    /** Hide the label visually (still read by screen readers). */
    hideLabel?: boolean;
    className?: string;
    children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({ label, hint, error, hideLabel = false, className, children }: FieldProps) {
    const id = useId();
    const noteId = `${id}-note`;
    const note = error ?? hint;
    return (
        <div className={cn("grid grid-cols-1 gap-1.5", className)}>
            <label htmlFor={id} className={cn("text-caption font-medium text-muted", hideLabel && "sr-only")}>
                {label}
            </label>
            {children({ id, "aria-describedby": note ? noteId : undefined, "aria-invalid": error ? true : undefined })}
            {note && (
                <p id={noteId} className={cn("text-caption", error ? "text-danger" : "text-subtle")}>
                    {note}
                </p>
            )}
        </div>
    );
}
