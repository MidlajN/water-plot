"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CaretDown, CaretUp } from "@phosphor-icons/react";

import { usePlotter } from "../plotter/PlotterContext";
import { focusRing, Segmented } from "./parts";

const STEPS = [0.1, 1, 10] as const;
const STEP_OPTIONS = STEPS.map((value) => ({ value, label: <span className="tabular-nums">{value}</span>, ariaLabel: `${value} mm` }));
const DEFAULT_FEED = 3000;

/**
 * Live machine position and a jog pad. Jogging is relative (mm) at the chosen step;
 * the server holds any move with Z to the Z feed ceiling.
 */
export function MachinePanel() {
    const { telemetry, gatewayConnected, busy, jog } = usePlotter();
    const [step, setStep] = useState<(typeof STEPS)[number]>(1);
    const [feed, setFeed] = useState(DEFAULT_FEED);

    const live = gatewayConnected && telemetry !== null;
    const canJog = live && !busy;
    const move = (axis: "x" | "y" | "z", direction: 1 | -1) => () => void jog({ [axis]: step * direction, feed });

    return (
        <div className="space-y-4">
            <dl className="grid grid-cols-3 gap-2" aria-label="Machine position">
                {(["X", "Y", "Z"] as const).map((axis, index) => (
                    <div key={axis} className="surface-raised rounded-xl px-3 py-2">
                        <dt className="type-caption font-semibold text-graphite">{axis}</dt>
                        <dd className="text-[1.25rem] font-semibold leading-7 tracking-[-0.01em] tabular-nums text-ink">
                            {live ? telemetry.mpos[index].toFixed(2) : "–"}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="type-footnote -mt-2 text-graphite">
                Feed <span className="tabular-nums text-ink">{live ? telemetry.feed.toLocaleString() : "–"}</span> mm/min
            </p>

            <div className="flex items-start gap-4">
                <div className="grid grid-cols-3 grid-rows-3 gap-1.5" role="group" aria-label="Jog X and Y">
                    <span />
                    <JogButton label={`Y +${step} mm`} disabled={!canJog} onClick={move("y", 1)}>
                        <ArrowUp size={16} weight="bold" />
                    </JogButton>
                    <span />
                    <JogButton label={`X −${step} mm`} disabled={!canJog} onClick={move("x", -1)}>
                        <ArrowLeft size={16} weight="bold" />
                    </JogButton>
                    <span className="type-caption flex h-9 w-9 items-center justify-center tabular-nums text-graphite">{step}</span>
                    <JogButton label={`X +${step} mm`} disabled={!canJog} onClick={move("x", 1)}>
                        <ArrowRight size={16} weight="bold" />
                    </JogButton>
                    <span />
                    <JogButton label={`Y −${step} mm`} disabled={!canJog} onClick={move("y", -1)}>
                        <ArrowDown size={16} weight="bold" />
                    </JogButton>
                    <span />
                </div>

                <div className="flex flex-col gap-1.5" role="group" aria-label="Jog Z">
                    <JogButton label={`Z +${step} mm (pen up)`} disabled={!canJog} onClick={move("z", 1)}>
                        <CaretUp size={16} weight="bold" />
                    </JogButton>
                    <span className="type-caption flex h-9 w-9 items-center justify-center font-semibold text-graphite">Z</span>
                    <JogButton label={`Z −${step} mm (pen down)`} disabled={!canJog} onClick={move("z", -1)}>
                        <CaretDown size={16} weight="bold" />
                    </JogButton>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                    <div>
                        <p className="type-caption mb-1 font-semibold text-graphite">Step (mm)</p>
                        <Segmented label="Step in millimetres" options={STEP_OPTIONS} value={step} onChange={setStep} itemClassName="px-1" />
                    </div>
                    <label className="block">
                        <span className="type-caption mb-1 block font-semibold text-graphite">XY feed (mm/min)</span>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={100}
                            max={20000}
                            step={100}
                            value={feed}
                            onChange={(event) => setFeed(Math.max(100, Math.min(20000, Number(event.target.value) || DEFAULT_FEED)))}
                            className={`surface-raised type-footnote h-8 w-full rounded-lg px-2.5 tabular-nums text-ink ${focusRing}`}
                        />
                    </label>
                </div>
            </div>

            {!canJog && (
                <p className="type-footnote text-graphite">
                    {!live ? "Jogging is available once the plotter is connected." : "Jogging is paused while a plot is running."}
                </p>
            )}
        </div>
    );
}

function JogButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={onClick}
            className={`press surface-raised flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-grouped active:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-35 ${focusRing}`}
        >
            {children}
        </button>
    );
}
