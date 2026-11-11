"use client";

import { ArrowArcLeft, ArrowArcRight } from "@phosphor-icons/react";

import { ConnectionChip } from "../desktop/parts";
import useCanvas from "../workspace/canvas/CanvasContext";
import { MoreMenu } from "./MoreMenu";

const iconButton =
    "press flex h-9 w-9 items-center justify-center rounded-full text-ink outline-none hover:bg-ink/[0.05] focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-35";

/**
 * Phone Edit: controls floating over the top of the page. The plotter's connection on
 * the left; Undo, Redo and More on the right, where they're always one tap away.
 */
export function CanvasActions() {
    const { workspace } = useCanvas() ?? {};

    return (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="material-float pointer-events-auto rounded-full p-0.5">
                <ConnectionChip />
            </span>
            <div role="toolbar" aria-label="Page actions" className="material-float pointer-events-auto flex items-center gap-0.5 rounded-full p-0.5">
                <button type="button" aria-label="Undo" title="Undo" disabled={!workspace} onClick={() => workspace?.undo()} className={iconButton}>
                    <ArrowArcLeft size={18} weight="bold" />
                </button>
                <button type="button" aria-label="Redo" title="Redo" disabled={!workspace} onClick={() => workspace?.redo()} className={iconButton}>
                    <ArrowArcRight size={18} weight="bold" />
                </button>
                <MoreMenu className={iconButton} />
            </div>
        </div>
    );
}
