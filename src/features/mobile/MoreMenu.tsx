"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowArcLeft, ArrowArcRight, DotsThree, DownloadSimple, FileArrowUp, Trash } from "@phosphor-icons/react";

import { useExport } from "../export/useExport";
import { useMode } from "../modes/ModeContext";
import { usePlotter } from "../plotter/PlotterContext";
import useCanvas from "../workspace/canvas/CanvasContext";

/** "⋯" button in the mobile card footer: export, plot a G-code file, undo, redo and delete. */
export function MoreMenu() {
    const { workspace } = useCanvas() ?? {};
    const { exporting, exportAs, ready } = useExport();
    const isEditMode = useMode().mode === "edit";
    const plotter = usePlotter();
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

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
                className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                    open ? "border-[#1c8096] bg-gray-100 text-[#1c8096]" : "border-gray-200 text-gray-600"
                }`}
            >
                <DotsThree size={22} weight="bold" />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        role="menu"
                        aria-label="More"
                        className="absolute bottom-full right-0 mb-2 w-56 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_8px_30px_rgba(0,0,0,0.15)]"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.15 }}
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
                        <div aria-hidden className="my-1 h-px bg-gray-100" />
                        <MenuItem icon={<ArrowArcLeft size={18} />} disabled={!workspace || !isEditMode} onClick={run(() => workspace?.undo())}>
                            Undo
                        </MenuItem>
                        <MenuItem icon={<ArrowArcRight size={18} />} disabled={!workspace || !isEditMode} onClick={run(() => workspace?.redo())}>
                            Redo
                        </MenuItem>
                        <MenuItem icon={<Trash size={18} />} disabled={!workspace || !isEditMode} onClick={run(() => workspace?.handleDelete())}>
                            Delete selected
                        </MenuItem>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function MenuItem({ icon, children, disabled, onClick }: { icon: ReactNode; children: ReactNode; disabled?: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={onClick}
            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-gray-700 transition-colors active:bg-gray-100 disabled:opacity-40"
        >
            <span aria-hidden className="text-gray-500">
                {icon}
            </span>
            {children}
        </button>
    );
}
