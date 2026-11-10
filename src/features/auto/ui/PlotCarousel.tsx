"use client";

import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowClockwise, ArrowLeft, CaretLeft, CaretRight } from "@phosphor-icons/react";

import { usePlotter } from "../../plotter/PlotterContext";
import { useAutoJobs } from "../AutoJobsContext";
import { formatJobTime, JOB_STATUS } from "../format";
import type { PlotJobSummary } from "../jobs";

const svgUrl = (id: number) => `/api/auto/jobs/${id}/svg`;
const NO_JOBS: PlotJobSummary[] = [];

/**
 * Recent Auto plots, newest first, swiped sideways. Scrolling and snapping are the
 * browser's own (so momentum, flicks and catching a slide mid-scroll all feel native);
 * this component only keeps the visible slide in sync with the selected plot.
 *
 * On the newest slide, new plots slide in as they arrive. While browsing older ones the
 * view stays put, and a "New plot" pill offers the way back.
 */
export function PlotCarousel() {
    const auto = useAutoJobs();
    const scroller = useRef<HTMLUListElement>(null);
    const reduceMotion = useReducedMotion();
    const jobs = auto?.jobs ?? NO_JOBS;
    const jobsRef = useRef(jobs);
    const indexRef = useRef(0);
    const frame = useRef(0);
    // The newest plot when the list first loaded; anything newer is an arrival and
    // animates in. (Set while rendering, so the first slides mount without animating.)
    const [baseline, setBaseline] = useState<number | null>(null);
    if (baseline === null && jobs.length > 0) setBaseline(jobs[0].id);
    // The newest plot the reader has seen, to tell "Latest" from "New plot".
    const [seenLatest, setSeenLatest] = useState<number | null>(null);

    const selected = auto?.selected ?? null;
    const index = Math.max(0, jobs.findIndex((item) => item.id === selected?.id));
    const following = auto?.following ?? true;
    const select = auto?.select;

    // Scroll position that centres slide i.
    const targetFor = useCallback((i: number) => {
        const element = scroller.current;
        const slide = element?.children[i] as HTMLElement | undefined;
        if (!element || !slide) return 0;
        return slide.offsetLeft - (element.clientWidth - slide.offsetWidth) / 2;
    }, []);

    const nearest = useCallback(() => {
        const element = scroller.current;
        if (!element) return 0;
        let best = 0;
        for (let i = 1; i < element.children.length; i++) {
            if (Math.abs(targetFor(i) - element.scrollLeft) < Math.abs(targetFor(best) - element.scrollLeft)) best = i;
        }
        return best;
    }, [targetFor]);

    // Keep refs current for the scroll handler, and keep the selected plot in view when
    // the list changes under it (a new plot is added at the front). Runs before paint, so
    // nothing visibly jumps.
    useLayoutEffect(() => {
        jobsRef.current = jobs;
        indexRef.current = index;
        const element = scroller.current;
        if (element && nearest() !== index) element.scrollTo({ left: targetFor(index), behavior: "instant" });
    }, [jobs, index, nearest, targetFor]);

    const onScroll = () => {
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
            const next = nearest();
            const list = jobsRef.current;
            if (next === indexRef.current || !list[next]) return;
            if (next === 0 || indexRef.current === 0) setSeenLatest(list[0]?.id ?? null);
            indexRef.current = next;
            select?.(next === 0 ? null : list[next].id);
        });
    };

    const go = (i: number) => {
        const clamped = Math.max(0, Math.min(jobs.length - 1, i));
        scroller.current?.scrollTo({ left: targetFor(clamped), behavior: reduceMotion ? "instant" : "smooth" });
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "ArrowLeft") go(index - 1);
        else if (event.key === "ArrowRight") go(index + 1);
        else if (event.key === "Home") go(0);
        else if (event.key === "End") go(jobs.length - 1);
        else return;
        event.preventDefault();
    };

    if (!auto) return null;

    if (jobs.length === 0) {
        return (
            <section aria-labelledby="recent-plots-title">
                <Header />
                <div className="px-5 md:px-8">
                    <div className="flex aspect-[690/290] flex-col items-center justify-center gap-1 rounded-xl bg-white/70 px-6 text-center shadow-[inset_0_0_0_1px_var(--color-separator)]">
                        {auto.status === "error" ? (
                            <>
                                <p className="type-headline text-ink">Couldn’t load recent plots</p>
                                <button
                                    type="button"
                                    onClick={() => void auto.refresh()}
                                    className="press type-footnote mt-1 rounded-full px-3 py-1 font-semibold text-teal outline-none focus-visible:ring-2 focus-visible:ring-teal"
                                >
                                    Try again
                                </button>
                            </>
                        ) : auto.status === "loading" ? (
                            <p className="type-footnote text-graphite">Loading plots…</p>
                        ) : (
                            <>
                                <p className="type-headline text-ink">No plots yet</p>
                                <p className="type-footnote text-graphite">The first one is drawn at the start of the next minute.</p>
                            </>
                        )}
                    </div>
                </div>
            </section>
        );
    }

    const unseen = !following && seenLatest !== null && jobs[0]?.id !== seenLatest;

    return (
        <section aria-labelledby="recent-plots-title">
            <Header>
                <AnimatePresence initial={false}>
                    {index > 0 && (
                        <motion.button
                            type="button"
                            onClick={() => go(0)}
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
                            transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                            className="press type-footnote flex h-7 origin-right items-center gap-1.5 rounded-full bg-teal/10 pl-2 pr-3 font-semibold text-teal outline-none hover:bg-teal/15 focus-visible:ring-2 focus-visible:ring-teal"
                        >
                            <ArrowLeft size={13} weight="bold" />
                            {unseen ? "New plot" : "Latest"}
                            {unseen && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-teal" />}
                        </motion.button>
                    )}
                </AnimatePresence>
            </Header>
            <div className="relative">
                <ul
                    ref={scroller}
                    tabIndex={0}
                    aria-label="Recent plots, newest first"
                    aria-roledescription="carousel"
                    onScroll={onScroll}
                    onKeyDown={onKeyDown}
                    className="no-scrollbar relative flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain px-5 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-teal/60 md:gap-4 md:rounded-2xl md:px-8"
                >
                    {jobs.map((job, i) => (
                        <Slide
                            key={job.id}
                            job={job}
                            position={`${i + 1} of ${jobs.length}`}
                            current={i === index}
                            animateIn={baseline !== null && job.id > baseline && !reduceMotion}
                        />
                    ))}
                </ul>

                {/* Desktop: step through with buttons on the paper's edges (and ← / → on the focused carousel). */}
                <div className="pointer-events-none absolute inset-x-0 top-0 hidden md:block">
                    <div className="relative mx-8 aspect-[690/290]">
                        <CarouselArrow side="left" label="Newer plot" disabled={index === 0} onClick={() => go(index - 1)} />
                        <CarouselArrow side="right" label="Older plot" disabled={index >= jobs.length - 1} onClick={() => go(index + 1)} />
                    </div>
                </div>
            </div>
        </section>
    );
}

function Header({ children }: { children?: ReactNode }) {
    return (
        <div className="mb-3 flex min-h-7 items-center justify-between gap-3 px-5 md:px-9">
            <h2 id="recent-plots-title" className="type-headline text-ink">
                Recent plots
            </h2>
            {children}
        </div>
    );
}

function Slide({ job, position, current, animateIn }: { job: PlotJobSummary; position: string; current: boolean; animateIn: boolean }) {
    const { sendSvg, gatewayConnected, busy, sending } = usePlotter();
    const [failed, setFailed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const status = JOB_STATUS[job.status];
    const time = formatJobTime(job.scheduledAt);

    const plotAgain = async () => {
        setError(null);
        try {
            const response = await fetch(svgUrl(job.id), { cache: "no-store" });
            if (!response.ok) throw new Error();
            await sendSvg(await response.text(), `auto-job-${job.id}`);
        } catch {
            setError("Couldn’t load this plot.");
        }
    };

    const canPlot = current && job.hasSvg && !failed && gatewayConnected && !busy && !sending;

    return (
        <motion.li
            aria-roledescription="slide"
            aria-label={`${position}: ${time}`}
            aria-current={current || undefined}
            initial={animateIn ? { opacity: 0, scale: 0.94 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", bounce: 0, duration: 0.55 }}
            className="w-full shrink-0 snap-center"
        >
            <div
                className={`aspect-[690/290] overflow-hidden rounded-xl bg-white shadow-[0_0_0_0.5px_rgb(0_0_0/0.05),0_1px_2px_rgb(31_39_51/0.06),0_10px_28px_rgb(31_39_51/0.09)] transition-opacity duration-300 ${
                    current ? "opacity-100" : "opacity-55"
                }`}
            >
                {job.hasSvg && !failed ? (
                    // eslint-disable-next-line @next/next/no-img-element -- generated SVG from our own API
                    <img
                        src={svgUrl(job.id)}
                        alt={job.quote ? `Clock and quote: ${job.quote}` : "Generated plot"}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                        onError={() => setFailed(true)}
                        className="h-full w-full select-none object-contain"
                    />
                ) : (
                    <p className="type-footnote flex h-full items-center justify-center text-graphite">
                        {failed ? "Couldn’t load the drawing." : "This plot has no drawing."}
                    </p>
                )}
            </div>

            <div className={`mt-3 flex items-start gap-3 px-1 transition-opacity duration-300 ${current ? "opacity-100" : "opacity-40"}`}>
                <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                        <span className="type-headline tabular-nums text-ink">{time}</span>
                        <span className={`type-caption inline-flex items-center gap-1 font-semibold ${status.text}`}>
                            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                            {status.label}
                        </span>
                    </p>
                    <p className="type-footnote mt-0.5 line-clamp-2 text-graphite">{job.quote ?? "No quote"}</p>
                    {job.error && <p className="type-caption mt-1 text-fault">{job.error}</p>}
                    {error && (
                        <p role="alert" className="type-caption mt-1 text-fault">
                            {error}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    tabIndex={current ? 0 : -1}
                    onClick={() => void plotAgain()}
                    disabled={!canPlot}
                    className="press type-footnote flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-teal/10 px-3.5 font-semibold text-teal outline-none hover:bg-teal/15 focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-40"
                >
                    <ArrowClockwise size={15} weight="bold" />
                    {sending && current ? "Sending…" : "Plot again"}
                </button>
            </div>
        </motion.li>
    );
}

function CarouselArrow({ side, label, disabled, onClick }: { side: "left" | "right"; label: string; disabled: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className={`press material-float pointer-events-auto absolute top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:pointer-events-none disabled:opacity-0 ${
                side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
            }`}
        >
            {side === "left" ? <CaretLeft size={18} weight="bold" /> : <CaretRight size={18} weight="bold" />}
        </button>
    );
}
