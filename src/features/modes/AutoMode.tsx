"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowClockwise, ClockCountdown } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { RegistrationMarks } from "@/components/ui/paper";
import { StatusPill } from "@/components/ui/status";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useAutoJobs } from "../auto/AutoJobsContext";
import type { PlotJobSummary } from "../auto/jobs";
import { JOB_STATUS, formatJobTime } from "../desktop/AutoSection";
import { usePlotter } from "../plotter/PlotterContext";

const svgUrl = (id: number) => `/api/auto/jobs/${id}/svg`;

/**
 * Auto mode viewer: previews the plot picked in the sidebar or the mobile card (the
 * newest by default), with a way to plot it again.
 */
export function AutoMode() {
    const auto = useAutoJobs();

    if (!auto) return <main aria-label="Auto mode" className="h-[52dvh] bg-surface-sunken md:h-full" />;

    const { selected, status } = auto;

    return (
        <main aria-label="Auto mode" className="flex h-[52dvh] items-center justify-center bg-surface-sunken px-5 pt-4 pb-8 md:h-full md:p-12">
            <AnimatePresence mode="wait" initial={false}>
                {selected ? (
                    <motion.div
                        key={selected.id}
                        className="flex w-full justify-center"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0, transition: { duration: DURATION.base, ease: EASE_OUT } }}
                        exit={{ opacity: 0, transition: { duration: DURATION.fast } }}
                    >
                        <PlotPreview job={selected} />
                    </motion.div>
                ) : (
                    <div className="grid max-w-sm justify-items-center gap-3 text-center">
                        <span className="grid size-10 place-items-center rounded-full bg-surface text-muted shadow-hairline">
                            <ClockCountdown className="size-5" />
                        </span>
                        <p className="text-ui text-muted">{status === "loading" ? "Loading plots…" : "No plots yet. A new plot appears here every minute while Auto is on."}</p>
                    </div>
                )}
            </AnimatePresence>
        </main>
    );
}

function PlotPreview({ job }: { job: PlotJobSummary }) {
    const { sendSvg, gatewayConnected, busy, sending } = usePlotter();
    const [error, setError] = useState<string | null>(null);
    const { label, tone } = JOB_STATUS[job.status];

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
        <figure className="flex w-full max-w-4xl flex-col gap-5 md:gap-7">
            <div className="relative">
                <RegistrationMarks offset="-inset-3" />
                <div className="aspect-[690/290] w-full overflow-hidden rounded-[2px] bg-paper shadow-paper">
                    {job.hasSvg ? (
                        // eslint-disable-next-line @next/next/no-img-element -- generated SVG from our own API
                        <img src={svgUrl(job.id)} alt={job.quote ? `Clock and quote: ${job.quote}` : "Generated plot"} className="h-full w-full object-contain" />
                    ) : (
                        <p className="flex h-full items-center justify-center text-ui text-muted">This plot has no drawing.</p>
                    )}
                </div>
            </div>

            <figcaption className="flex items-start justify-between gap-4 md:gap-8">
                <div className="grid min-w-0 gap-1.5">
                    <p className="flex items-center gap-2.5">
                        <StatusPill tone={tone} live={job.status === "running"}>
                            {label}
                        </StatusPill>
                        <span className="numeric text-caption text-muted">{formatJobTime(job.scheduledAt)}</span>
                    </p>
                    {job.quote && <p className="text-body text-text">{job.quote}</p>}
                    {job.error && <p className="text-caption text-danger">{job.error}</p>}
                    {error && <p className="text-caption text-danger">{error}</p>}
                </div>
                <Button onClick={() => void plotAgain()} disabled={!job.hasSvg || !gatewayConnected || busy || sending} className="shrink-0">
                    <ArrowClockwise />
                    Plot again
                </Button>
            </figcaption>
        </figure>
    );
}
