"use client";

import { DownloadSimple, FileArrowUp, PaperPlaneTilt } from "@phosphor-icons/react";

import { useExport } from "../export/useExport";
import { usePlotter } from "../plotter/PlotterContext";
import { PrimaryButton, QuietButton, SecondaryButton } from "./parts";

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
        <div className="space-y-2.5">
            <PrimaryButton
                icon={<PaperPlaneTilt size={16} weight="bold" />}
                onClick={() => void send()}
                disabled={!ready || blocked}
            >
                {sending ? "Sending…" : "Plot this page"}
            </PrimaryButton>
            <SecondaryButton icon={<FileArrowUp size={16} />} onClick={pickFile} disabled={blocked} className="w-full">
                Plot a G-code file…
            </SecondaryButton>

            {error ? (
                <p role="alert" className="flex items-start justify-between gap-2 text-xs leading-5 text-fault">
                    <span>{error}</span>
                    <button type="button" onClick={dismiss} className="shrink-0 font-medium underline underline-offset-2">
                        Dismiss
                    </button>
                </p>
            ) : (
                reason && <p className="text-xs leading-5 text-graphite">{reason}</p>
            )}

            <div className="-ml-1.5 flex gap-1 pt-0.5">
                <QuietButton
                    icon={<DownloadSimple size={14} />}
                    onClick={() => void exportAs("svg")}
                    disabled={!ready || exporting !== null}
                >
                    {exporting === "svg" ? "Preparing…" : "Download SVG"}
                </QuietButton>
                <QuietButton
                    icon={<DownloadSimple size={14} />}
                    onClick={() => void exportAs("gcode")}
                    disabled={!ready || exporting !== null}
                >
                    {exporting === "gcode" ? "Preparing…" : "Download G-code"}
                </QuietButton>
            </div>
        </div>
    );
}
