"use client";

import { DownloadSimple, FileArrowUp, PaperPlaneTilt } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { useExport } from "../export/useExport";
import { usePlotter } from "../plotter/PlotterContext";

/** Edit mode: send the page (or a G-code file) to the plotter, or download it. */
export function PlotSection() {
    const { send, pickFile, sending, busy, gatewayConnected, link, error, dismiss } = usePlotter();
    const { exporting, exportAs, ready } = useExport();

    const blocked = !gatewayConnected || busy || sending;
    const reason =
        link !== "online"
            ? "Waiting for the app server…"
            : !gatewayConnected
              ? "The plotter is offline. Check that the gateway is running."
              : busy && !sending
                ? "A plot is in progress."
                : null;

    return (
        <div className="grid grid-cols-1 gap-2">
            <Button variant="primary" size="lg" block busy={sending} onClick={() => void send()} disabled={!ready || blocked}>
                <PaperPlaneTilt weight="fill" />
                Plot this page
            </Button>
            <Button block onClick={pickFile} disabled={blocked}>
                <FileArrowUp />
                Plot a G-code file…
            </Button>

            {error ? (
                <p role="alert" className="mt-1 flex items-start justify-between gap-3 rounded-control bg-danger-soft px-3 py-2 text-caption text-danger">
                    <span>{error}</span>
                    <button type="button" onClick={dismiss} className="focus-ring shrink-0 rounded-[4px] font-semibold underline underline-offset-2">
                        Dismiss
                    </button>
                </p>
            ) : (
                reason && <p className="mt-1 text-caption text-muted">{reason}</p>
            )}

            <div className="-mx-2 mt-1 flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => void exportAs("svg")} disabled={!ready || exporting !== null} busy={exporting === "svg"}>
                    <DownloadSimple /> Download SVG
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void exportAs("gcode")} disabled={!ready || exporting !== null} busy={exporting === "gcode"}>
                    <DownloadSimple /> Download G-code
                </Button>
            </div>
        </div>
    );
}
