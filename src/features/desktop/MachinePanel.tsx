"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CaretDown, CaretUp } from "@phosphor-icons/react";

import { usePlotter } from "../plotter/PlotterContext";
import { focusRing } from "./parts";

const STEPS = [0.1, 1, 10] as const;
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
                    <div key={axis} className="rounded-lg bg-desk/60 px-2.5 py-2">
                        <dt className="text-xs text-graphite">{axis}</dt>
                        <dd className="font-mono text-xl leading-7 tabular-nums text-ink">
                            {live ? telemetry.mpos[index].toFixed(2) : "–"}
                        </dd>
                    </div>
                ))}
            </dl>
            <p className="-mt-2 text-xs text-graphite">
                Feed{" "}
                <span className="font-mono tabular-nums text-ink">{live ? telemetry.feed.toLocaleString() : "–"}</span>{" "}
                mm/min
            </p>

            <div className="flex items-start gap-4">
                <div className="grid grid-cols-3 grid-rows-3 gap-1" role="group" aria-label="Jog X and Y">
                    <span />
                    <JogButton label={`Y +${step} mm`} disabled={!canJog} onClick={move("y", 1)}>
                        <ArrowUp size={16} />
                    </JogButton>
                    <span />
                    <JogButton label={`X −${step} mm`} disabled={!canJog} onClick={move("x", -1)}>
                        <ArrowLeft size={16} />
                    </JogButton>
                    <span className="flex h-9 w-9 items-center justify-center font-mono text-[11px] tabular-nums text-graphite">
                        {step}
                    </span>
                    <JogButton label={`X +${step} mm`} disabled={!canJog} onClick={move("x", 1)}>
                        <ArrowRight size={16} />
                    </JogButton>
                    <span />
                    <JogButton label={`Y −${step} mm`} disabled={!canJog} onClick={move("y", -1)}>
                        <ArrowDown size={16} />
                    </JogButton>
                    <span />
                </div>

                <div className="flex flex-col gap-1" role="group" aria-label="Jog Z">
                    <JogButton label={`Z +${step} mm (pen up)`} disabled={!canJog} onClick={move("z", 1)}>
                        <CaretUp size={16} />
                    </JogButton>
                    <span className="flex h-9 w-9 items-center justify-center text-xs text-graphite">Z</span>
                    <JogButton label={`Z −${step} mm (pen down)`} disabled={!canJog} onClick={move("z", -1)}>
                        <CaretDown size={16} />
                    </JogButton>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                    <fieldset>
                        <legend className="mb-1 text-xs text-graphite">Step (mm)</legend>
                        <div className="flex rounded-lg border border-rule p-0.5">
                            {STEPS.map((value) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={step === value}
                                    onClick={() => setStep(value)}
                                    className={`h-7 flex-1 rounded-md font-mono text-xs tabular-nums transition-colors ${focusRing} ${
                                        step === value ? "bg-teal/10 font-medium text-teal" : "text-graphite hover:text-ink"
                                    }`}
                                >
                                    {value}
                                </button>
                            ))}
                        </div>
                    </fieldset>
                    <label className="block">
                        <span className="mb-1 block text-xs text-graphite">XY feed (mm/min)</span>
                        <input
                            type="number"
                            inputMode="numeric"
                            min={100}
                            max={20000}
                            step={100}
                            value={feed}
                            onChange={(event) => setFeed(Math.max(100, Math.min(20000, Number(event.target.value) || DEFAULT_FEED)))}
                            className={`h-8 w-full rounded-lg border border-rule px-2 font-mono text-xs tabular-nums text-ink ${focusRing}`}
                        />
                    </label>
                </div>
            </div>

            {!canJog && (
                <p className="text-xs text-graphite">
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
            className={`flex h-9 w-9 items-center justify-center rounded-lg border border-rule bg-white text-ink transition-colors hover:bg-desk active:bg-teal/10 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
        >
            {children}
        </button>
    );
}
