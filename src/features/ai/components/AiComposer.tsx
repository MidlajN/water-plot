"use client";

import { useRef, type KeyboardEvent } from "react";
import { CircleNotch, Sparkle } from "@phosphor-icons/react";

import { focusRing } from "../../desktop/parts";
import { CATEGORY_CHOICES, EXAMPLE_PROMPTS, useAiStudio } from "../AiStudioContext";
import { LIMITS } from "../constants";

/**
 * The AI Creative Studio prompt: a text field, a category choice, example prompts and
 * the Generate button. `compact` is the phone layout inside the bottom card.
 */
export function AiComposer({ compact = false }: { compact?: boolean }) {
    const { prompt, setPrompt, category, setCategory, busy, generate } = useAiStudio();
    const field = useRef<HTMLTextAreaElement>(null);
    const generating = busy;
    const tooShort = prompt.trim().length < LIMITS.promptMin;

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        // ⌘/Ctrl+Enter generates; plain Enter adds a line.
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            if (!tooShort) void generate();
        }
    };

    const applyExample = (example: (typeof EXAMPLE_PROMPTS)[number]) => {
        setPrompt(example.prompt);
        setCategory(example.category);
        field.current?.focus();
    };

    return (
        <form
            aria-label="Describe a design"
            className={compact ? "space-y-2.5" : "space-y-3"}
            onSubmit={(event) => {
                event.preventDefault();
                void generate();
            }}
        >
            <label className="block">
                <span className="sr-only">Describe your idea</span>
                <textarea
                    ref={field}
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value.slice(0, LIMITS.promptMax))}
                    onKeyDown={onKeyDown}
                    rows={compact ? 2 : 3}
                    maxLength={LIMITS.promptMax}
                    disabled={generating}
                    placeholder="A continuous-line drawing of a heron at dawn…"
                    className={`w-full resize-none rounded-xl border border-rule bg-white px-3.5 py-3 text-ink placeholder:text-graphite/60 disabled:bg-desk/50 ${
                        compact ? "text-base" : "text-[15px] leading-6"
                    } ${focusRing}`}
                />
            </label>

            <div className={`flex gap-2 ${compact ? "flex-col" : "items-center justify-between"}`}>
                <div role="radiogroup" aria-label="Kind of design" className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 [scrollbar-width:none]">
                    {CATEGORY_CHOICES.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={category === id}
                            disabled={generating}
                            onClick={() => setCategory(id)}
                            className={`h-8 shrink-0 rounded-full px-3 text-[13px] transition-colors disabled:opacity-50 ${focusRing} ${
                                category === id ? "bg-teal/10 font-medium text-teal" : "text-graphite hover:bg-desk hover:text-ink"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className={`flex items-center gap-3 ${compact ? "justify-between" : ""}`}>
                    <span className="font-mono text-[11px] tabular-nums text-graphite" aria-label="Characters used">
                        {prompt.length}/{LIMITS.promptMax}
                    </span>
                    <button
                        type="submit"
                        disabled={generating || tooShort}
                        className={`flex h-10 items-center justify-center gap-2 rounded-lg bg-teal px-4 text-[13px] font-medium text-white transition-colors hover:bg-teal-dark disabled:cursor-not-allowed disabled:bg-teal/40 ${
                            compact ? "flex-1" : ""
                        } ${focusRing}`}
                    >
                        {generating ? (
                            <CircleNotch size={16} weight="bold" className="motion-safe:animate-spin" />
                        ) : (
                            <Sparkle size={16} weight="fill" />
                        )}
                        {generating ? "Creating…" : "Generate"}
                    </button>
                </div>
            </div>

            <div className={compact ? "space-y-1.5" : "flex flex-wrap items-center gap-1.5"}>
                <span className="text-xs text-graphite">Try</span>
                <ul className={`flex gap-1.5 ${compact ? "overflow-x-auto [scrollbar-width:none]" : "flex-wrap"}`}>
                    {EXAMPLE_PROMPTS.map((example) => (
                        <li key={example.prompt} className="shrink-0">
                            <button
                                type="button"
                                disabled={generating}
                                onClick={() => applyExample(example)}
                                className={`rounded-full border border-rule bg-white px-3 py-1 text-xs text-ink transition-colors hover:bg-desk disabled:opacity-50 ${focusRing}`}
                            >
                                {example.prompt}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </form>
    );
}
