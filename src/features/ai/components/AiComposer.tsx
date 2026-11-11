"use client";

import { useRef, type KeyboardEvent } from "react";
import { CircleNotch, Sparkle } from "@phosphor-icons/react";

import { Tooltip } from "@/components/ui/tooltip";
import { focusRing } from "../../desktop/parts";
import { CATEGORY_CHOICES, EXAMPLE_PROMPTS, useAiStudio } from "../AiStudioContext";
import { LIMITS } from "../constants";

/**
 * The AI Studio prompt card: the idea, the kind of design and Generate, with example
 * prompts underneath. `compact` is the phone layout (16 px text so iOS doesn't zoom).
 */
export function AiComposer({ compact = false }: { compact?: boolean }) {
    const { prompt, setPrompt, category, setCategory, busy, generate } = useAiStudio();
    const field = useRef<HTMLTextAreaElement>(null);
    const generating = busy;
    const tooShort = prompt.trim().length < LIMITS.promptMin;
    const nearLimit = prompt.length > LIMITS.promptMax * 0.9;

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
        <div className="space-y-3">
            <form
                aria-label="Describe a design"
                className="space-y-3 rounded-[1.25rem] bg-surface-raised p-4 transition-shadow focus-within:shadow-[0_0_0_2px_var(--accent-line)]"
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
                        rows={3}
                        maxLength={LIMITS.promptMax}
                        disabled={generating}
                        placeholder="A continuous-line drawing of a heron at dawn…"
                        className={`block w-full resize-none bg-transparent text-ink outline-none placeholder:text-graphite/60 disabled:text-graphite ${
                            compact ? "text-base leading-6" : "type-body"
                        }`}
                    />
                </label>

                <div role="radiogroup" aria-label="Kind of design" className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
                    {CATEGORY_CHOICES.map(({ id, label }) => (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={category === id}
                            disabled={generating}
                            onClick={() => setCategory(id)}
                            className={`press type-footnote h-8 shrink-0 rounded-full px-3.5 font-semibold disabled:opacity-50 ${focusRing} ${
                                category === id ? "bg-teal text-on-accent" : "bg-grouped text-ink/75 hover:text-ink"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-separator pt-3">
                    <span className={`type-caption tabular-nums ${nearLimit ? "text-warn" : "text-graphite"}`} aria-label="Characters used">
                        {prompt.length}/{LIMITS.promptMax}
                    </span>
                    <Tooltip label="Generate" shortcut="Ctrl/⌘ + Enter">
                        <button
                            type="submit"
                            disabled={generating || tooShort}
                            className={`press type-footnote flex h-10 items-center justify-center gap-2 rounded-full bg-teal px-5 font-semibold text-on-accent hover:bg-teal-dark disabled:cursor-not-allowed disabled:bg-teal/35 ${focusRing}`}
                        >
                            {generating ? (
                                <CircleNotch size={16} weight="bold" className="motion-safe:animate-spin" />
                            ) : (
                                <Sparkle size={16} weight="fill" />
                            )}
                            {generating ? "Creating…" : "Generate"}
                        </button>
                    </Tooltip>
                </div>
            </form>

            <div className="space-y-1.5">
                <p className="type-footnote px-1 font-semibold text-graphite">Try</p>
                <ul className={`flex gap-1.5 ${compact ? "no-scrollbar -mx-4 overflow-x-auto px-4" : "flex-wrap"}`}>
                    {EXAMPLE_PROMPTS.map((example) => (
                        <li key={example.prompt} className="shrink-0">
                            <button
                                type="button"
                                disabled={generating}
                                onClick={() => applyExample(example)}
                                className={`press type-footnote surface-raised rounded-full px-3.5 py-1.5 text-ink hover:bg-surface-raised/70 disabled:opacity-50 ${focusRing}`}
                            >
                                {example.prompt}
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
