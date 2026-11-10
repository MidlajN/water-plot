"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DotsThree, DownloadSimple, FileArrowUp, Trash } from "@phosphor-icons/react";

import { useExport } from "../export/useExport";
import { usePlotter } from "../plotter/PlotterContext";
import useCanvas from "../workspace/canvas/CanvasContext";

/**
 * "⋯" in the phone Edit bar over the page: export, plot a G-code file and delete the
 * selection. The menu grows down out of the button and goes back the same way.
 */
export function MoreMenu({ className = "" }: { className?: string }) {
    const { workspace } = useCanvas() ?? {};
    const { exporting, exportAs, ready } = useExport();
    const plotter = usePlotter();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (!open) return;

        const onPointerDown = (event: PointerEvent) => {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [open]);

    const run = (action: () => void) => () => {
        action();
        setOpen(false);
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                aria-label="More"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(!open)}
                className={`${className} ${open ? "bg-black/[0.07]" : ""}`}
            >
                <DotsThree size={22} weight="bold" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        role="menu"
                        aria-label="More"
                        className="material-float absolute right-0 top-full z-30 mt-2 w-56 origin-top-right overflow-hidden rounded-2xl py-1"
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
                        transition={{ type: "spring", bounce: 0, duration: 0.28 }}
                    >
                        <MenuItem icon={<DownloadSimple size={18} />} disabled={!ready || exporting !== null} onClick={run(() => void exportAs("svg"))}>
                            {exporting === "svg" ? "Exporting…" : "Export SVG"}
                        </MenuItem>
                        <MenuItem icon={<DownloadSimple size={18} />} disabled={!ready || exporting !== null} onClick={run(() => void exportAs("gcode"))}>
                            {exporting === "gcode" ? "Exporting…" : "Export G-code"}
                        </MenuItem>
                        <MenuItem
                            icon={<FileArrowUp size={18} />}
                            disabled={!plotter.gatewayConnected || plotter.busy || plotter.sending}
                            onClick={run(plotter.pickFile)}
                        >
                            Plot G-code file…
                        </MenuItem>
                        <div aria-hidden className="mx-4 my-1 h-px bg-separator" />
                        <MenuItem icon={<Trash size={18} />} destructive disabled={!workspace} onClick={run(() => workspace?.handleDelete())}>
                            Delete selected
                        </MenuItem>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function MenuItem({
    icon,
    children,
    disabled,
    destructive = false,
    onClick,
}: {
    icon: ReactNode;
    children: ReactNode;
    disabled?: boolean;
    destructive?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={onClick}
            className={`type-body flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left outline-none transition-colors active:bg-black/[0.06] focus-visible:bg-black/[0.06] disabled:opacity-35 ${
                destructive ? "text-fault" : "text-ink"
            }`}
        >
            {children}
            <span aria-hidden className={destructive ? "text-fault" : "text-ink/60"}>
                {icon}
            </span>
        </button>
    );
}
