"use client";

import { useRef, type KeyboardEvent } from "react";
import { Sparkle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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

    const categories = (
        <div role="radiogroup" aria-label="Kind of design" className="-mx-1 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
            {CATEGORY_CHOICES.map(({ id, label }) => (
                <Chip key={id} role="radio" size="sm" aria-checked={category === id} selected={category === id} disabled={generating} onClick={() => setCategory(id)}>
                    {label}
                </Chip>
            ))}
        </div>
    );

    return (
        <form
            aria-label="Describe a design"
            className="grid grid-cols-1 gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                void generate();
            }}
        >
            <div
                className={cn(
                    "rounded-panel border border-line bg-surface-raised shadow-raised transition-[border-color,box-shadow] duration-150",
                    "focus-within:border-accent-line focus-within:shadow-[var(--elev-raised),0_0_0_4px_color-mix(in_oklch,var(--accent)_14%,transparent)]",
                    generating && "opacity-70",
                )}
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
                        className={cn(
                            "block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-text outline-none disabled:cursor-not-allowed",
                            compact ? "text-base" : "text-body",
                        )}
                    />
                </label>

                <div className={cn("flex gap-2 px-3 pt-1 pb-3", compact ? "flex-col" : "items-center justify-between")}>
                    {categories}
                    <div className={cn("flex shrink-0 items-center gap-3", compact && "justify-between")}>
                        <span className={cn("numeric text-micro", nearLimit ? "text-warn" : "text-subtle")} aria-label="Characters used">
                            {prompt.length}/{LIMITS.promptMax}
                        </span>
                        <Tooltip label="Generate" shortcut="Ctrl/⌘ + Enter">
                            <Button type="submit" variant="primary" busy={generating} disabled={tooShort} className={cn(compact && "flex-1")}>
                                <Sparkle weight="fill" />
                                Generate
                            </Button>
                        </Tooltip>
                    </div>
                </div>
            </div>

            <div className={cn("flex gap-2", compact ? "flex-col" : "flex-wrap items-center")}>
                <span className="text-caption text-subtle">Try</span>
                <ul className={cn("flex gap-1.5", compact ? "-mx-1 overflow-x-auto px-1 [scrollbar-width:none]" : "flex-wrap")}>
                    {EXAMPLE_PROMPTS.map((example) => (
                        <li key={example.prompt} className="shrink-0">
                            <Chip size="sm" disabled={generating} onClick={() => applyExample(example)}>
                                {example.prompt}
                            </Chip>
                        </li>
                    ))}
                </ul>
            </div>
        </form>
    );
}
