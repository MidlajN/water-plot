"use client";

import { useState } from "react";
import { ArrowClockwise } from "@phosphor-icons/react";

import { useAutoJobs } from "../auto/AutoJobsContext";
import type { PlotJobSummary } from "../auto/jobs";
import { JOB_STATUS, formatJobTime } from "../desktop/AutoSection";
import { SecondaryButton } from "../desktop/parts";
import { usePlotter } from "../plotter/PlotterContext";

const svgUrl = (id: number) => `/api/auto/jobs/${id}/svg`;

/**
 * Auto mode viewer: previews the plot picked in the sidebar or the mobile card (the
 * newest by default), with a way to plot it again.
 */
export function AutoMode() {
    const auto = useAutoJobs();

    if (!auto) return <main aria-label="Auto mode" className="h-[52dvh] bg-gray-200 md:h-full" />;

    const { selected, status } = auto;

    return (
        <main aria-label="Auto mode" className="flex h-[52dvh] items-center justify-center bg-desk px-4 pb-8 pt-4 md:h-full md:p-10">
            {selected ? (
                <PlotPreview key={selected.id} job={selected} />
            ) : (
                <p className="max-w-sm text-center text-sm leading-6 text-graphite">
                    {status === "loading" ? "Loading plots…" : "No plots yet. A new plot appears here every minute while Auto is on."}
                </p>
            )}
        </main>
    );
}

function PlotPreview({ job }: { job: PlotJobSummary }) {
    const { sendSvg, gatewayConnected, busy, sending } = usePlotter();
    const [error, setError] = useState<string | null>(null);
    const { label, dot } = JOB_STATUS[job.status];

    const plotAgain = async () => {
        setError(null);
        try {
            const response = await fetch(svgUrl(job.id), { cache: "no-store" });
            if (!response.ok) throw new Error();
            await sendSvg(await response.text(), `auto-job-${job.id}`);
        } catch {
            setError("Couldn't load this plot.");
        }
    };

    return (
        <figure className="flex w-full max-w-4xl flex-col gap-3 md:gap-5">
            <div className="aspect-[690/290] w-full overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgba(31,39,51,0.06),0_12px_32px_rgba(31,39,51,0.10)]">
                {job.hasSvg ? (
                    // eslint-disable-next-line @next/next/no-img-element -- generated SVG from our own API
                    <img src={svgUrl(job.id)} alt={job.quote ? `Clock and quote: ${job.quote}` : "Generated plot"} className="h-full w-full object-contain" />
                ) : (
                    <p className="flex h-full items-center justify-center text-sm text-graphite">This plot has no drawing.</p>
                )}
            </div>

            <figcaption className="flex items-start justify-between gap-3 md:gap-6">
                <div className="min-w-0 space-y-1">
                    <p className="flex items-center gap-2 text-[13px] text-ink">
                        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                        {label}
                        <span className="font-mono text-xs tabular-nums text-graphite">{formatJobTime(job.scheduledAt)}</span>
                    </p>
                    {job.quote && <p className="text-[13px] leading-5 text-ink md:text-sm md:leading-6">{job.quote}</p>}
                    {job.error && <p className="text-xs text-fault">{job.error}</p>}
                    {error && <p className="text-xs text-fault">{error}</p>}
                </div>
                <SecondaryButton
                    icon={<ArrowClockwise size={15} />}
                    onClick={() => void plotAgain()}
                    disabled={!job.hasSvg || !gatewayConnected || busy || sending}
                    className="shrink-0"
                >
                    Plot again
                </SecondaryButton>
            </figcaption>
        </figure>
    );
}
