"use client";

import { useState } from "react";
import { MotionConfig } from "framer-motion";
import {
    ArrowCounterClockwise,
    ArrowsClockwise,
    DotsThree,
    DownloadSimple,
    FileArrowUp,
    PaperPlaneTilt,
    Pause,
    Sparkle,
    Stop,
    Trash,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Card, Section } from "@/components/ui/panel";
import { PaperOnDesk } from "@/components/ui/paper";
import { Progress } from "@/components/ui/progress";
import { SegmentedControl } from "@/components/ui/segmented";
import { StatusPill } from "@/components/ui/status";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/features/theme/ThemeToggle";

const SWATCHES = [
    ["bg", "--bg"],
    ["surface", "--surface"],
    ["raised", "--surface-raised"],
    ["sunken", "--surface-sunken"],
    ["text", "--text"],
    ["muted", "--text-muted"],
    ["subtle", "--text-subtle"],
    ["line", "--line-strong"],
    ["accent", "--accent"],
    ["accent soft", "--accent-soft"],
    ["ok", "--ok"],
    ["warn", "--warn"],
    ["danger", "--danger"],
] as const;

const MODES = [
    { value: "auto", label: "Auto" },
    { value: "edit", label: "Edit" },
    { value: "ai", label: "AI" },
] as const;

const STEPS = [
    { value: "0.1", label: "0.1" },
    { value: "1", label: "1" },
    { value: "10", label: "10" },
] as const;

const CATEGORIES = ["Auto", "Poetry", "Line art", "Combination", "Custom"];

function SampleDrawing() {
    return (
        <svg viewBox="0 0 690 290" className="h-full w-full" fill="none" stroke="#111" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="150" cy="145" r="62" />
            {Array.from({ length: 12 }, (_, i) => {
                const a = (i * Math.PI) / 6;
                return <line key={i} x1={150 + Math.sin(a) * 50} y1={145 - Math.cos(a) * 50} x2={150 + Math.sin(a) * 56} y2={145 - Math.cos(a) * 56} />;
            })}
            <line x1="150" y1="145" x2="180" y2="125" strokeWidth="3" />
            <line x1="150" y1="145" x2="150" y2="102" strokeWidth="2" />
            <path d="M262 132c18-14 30 10 46-2s24-12 38 0 26 8 40-4 30 6 44-2 24-10 40 2" />
            <path d="M262 168c22-10 34 8 52-2s28-8 44 2 30 4 46-6 32 8 52 0" />
        </svg>
    );
}

function Theme({ theme }: { theme: "light" | "dark" }) {
    const [mode, setMode] = useState<string>("edit");
    const [step, setStep] = useState<string>("1");
    const [category, setCategory] = useState("Line art");

    return (
        <div data-theme={theme} className="min-w-0 flex-1 bg-bg text-text">
            <div className="mx-auto grid max-w-[760px] gap-8 px-8 py-10">
                <header className="flex items-start justify-between gap-6">
                    <div>
                        <p className="text-caption font-medium text-subtle">{theme === "light" ? "Light" : "Dark"} appearance</p>
                        <h1 className="mt-1 text-display font-semibold tracking-[-0.02em]">Plotter Studio</h1>
                        <p className="mt-2 max-w-[52ch] text-body text-muted">Draw on the page, then send it to the plotter. The paper stays paper in both appearances.</p>
                    </div>
                    <ThemeToggle />
                </header>

                {/* Composition: sidebar + desk */}
                <div className="grid grid-cols-[248px_1fr] overflow-hidden rounded-sheet bg-surface shadow-raised">
                    <aside className="flex flex-col border-r border-line">
                        <div className="flex items-center justify-between px-5 pt-5 pb-4">
                            <span className="text-ui font-semibold">Plotter Studio</span>
                            <StatusPill tone="ok" role="status">
                                Ready
                            </StatusPill>
                        </div>
                        <div className="px-5 pb-4">
                            <SegmentedControl aria-label="Mode" options={MODES} value={mode} onChange={setMode} block />
                        </div>
                        <Section title="Plot">
                            <div className="grid gap-2">
                                <Button variant="primary" block>
                                    <PaperPlaneTilt weight="fill" /> Plot this page
                                </Button>
                                <Button block>
                                    <FileArrowUp /> Plot a G-code file
                                </Button>
                            </div>
                        </Section>
                        <Section title="Current plot" aside={<span className="numeric text-caption text-muted">62%</span>}>
                            <Progress value={62} label="Plot progress" />
                            <div className="mt-2 flex justify-between text-caption text-muted">
                                <span>1,284 of 2,071 lines</span>
                                <span className="numeric">4:12 left</span>
                            </div>
                        </Section>
                    </aside>
                    <div className="p-4">
                        <PaperOnDesk className="grid h-full place-items-center p-8" sheetClassName="w-full max-w-[520px]">
                            <div className="aspect-[690/290] rounded-[2px] bg-paper shadow-paper">
                                <SampleDrawing />
                            </div>
                        </PaperOnDesk>
                    </div>
                </div>

                <div className="grid gap-3">
                    <h2 className="text-caption font-semibold text-muted">Colour</h2>
                    <div className="grid grid-cols-7 gap-2">
                        {SWATCHES.map(([name, token]) => (
                            <div key={name} className="grid gap-1.5">
                                <span className="h-10 rounded-[8px] shadow-hairline" style={{ background: `var(${token})` }} />
                                <span className="text-micro text-muted">{name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="grid gap-2">
                    <h2 className="text-caption font-semibold text-muted">Type</h2>
                    <p className="text-display font-semibold tracking-[-0.02em]">Create something beautiful</p>
                    <p className="text-title font-semibold tracking-[-0.01em]">Minimal Botanical Bloom</p>
                    <p className="text-body text-muted">A single continuous line, sized to the 690 × 290 mm page.</p>
                    <p className="text-ui">Plot this page · Download SVG · Feed 3000 mm/min</p>
                    <p className="numeric text-ui text-muted">X 214.30 Y 88.10 Z −0.50 · 12:04:31</p>
                </div>

                <Card className="grid gap-5 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="primary">
                            <Sparkle weight="fill" /> Generate
                        </Button>
                        <Button>
                            <DownloadSimple /> Download SVG
                        </Button>
                        <Button variant="ghost">
                            <ArrowCounterClockwise /> Undo
                        </Button>
                        <Button variant="danger">
                            <Stop weight="fill" /> Abort
                        </Button>
                        <Button variant="primary" busy>
                            Creating…
                        </Button>
                        <Button disabled>Disabled</Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Tooltip label="Pause" shortcut="Space">
                            <Button size="icon" aria-label="Pause">
                                <Pause weight="fill" />
                            </Button>
                        </Tooltip>
                        <Tooltip label="Regenerate">
                            <Button variant="ghost" size="icon" aria-label="Regenerate">
                                <ArrowsClockwise />
                            </Button>
                        </Tooltip>
                        <Menu>
                            <MenuTrigger asChild>
                                <Button variant="ghost" size="icon" aria-label="More actions">
                                    <DotsThree weight="bold" />
                                </Button>
                            </MenuTrigger>
                            <MenuContent>
                                <MenuItem icon={<DownloadSimple />} shortcut="⌘S">
                                    Export SVG
                                </MenuItem>
                                <MenuItem icon={<FileArrowUp />}>Plot a G-code file</MenuItem>
                                <MenuSeparator />
                                <MenuItem icon={<Trash />} tone="danger">
                                    Delete selection
                                </MenuItem>
                            </MenuContent>
                        </Menu>
                        <span className="ml-2 inline-flex items-center gap-1.5 text-caption text-muted">
                            Undo <Kbd>⌘</Kbd>
                            <Kbd>Z</Kbd>
                        </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <SegmentedControl aria-label="Jog step" semantics="radio" size="sm" options={STEPS} value={step} onChange={setStep} />
                        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
                            {CATEGORIES.map((name) => (
                                <Chip key={name} role="radio" aria-checked={category === name} selected={category === name} onClick={() => setCategory(name)} size="sm">
                                    {name}
                                </Chip>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <StatusPill tone="ok" live>
                            Connected
                        </StatusPill>
                        <StatusPill tone="accent" live>
                            Plotting
                        </StatusPill>
                        <StatusPill tone="warn">Paused</StatusPill>
                        <StatusPill tone="danger">Alarm</StatusPill>
                        <StatusPill>Offline</StatusPill>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Field label="Describe your design" hint="Up to 500 characters." className="col-span-2">
                            {(props) => <Textarea {...props} placeholder="A continuous-line drawing of a heron at dawn…" />}
                        </Field>
                        <Field label="Feed (mm/min)">{(props) => <Input {...props} className="numeric" defaultValue="3000" />}</Field>
                        <Field label="Clock time zone">
                            {(props) => (
                                <Select {...props} defaultValue="Asia/Kolkata">
                                    <option>Asia/Kolkata</option>
                                    <option>Europe/London</option>
                                </Select>
                            )}
                        </Field>
                        <Field label="Refine" error="Describe the change in a few words." className="col-span-2">
                            {(props) => <Input {...props} defaultValue="" placeholder="Make it more minimal" />}
                        </Field>
                    </div>
                </Card>
            </div>
        </div>
    );
}

export function StyleTile() {
    return (
        <MotionConfig reducedMotion="user">
            <TooltipProvider>
                <main className="flex min-h-screen flex-col lg:flex-row">
                    <Theme theme="light" />
                    <Theme theme="dark" />
                </main>
            </TooltipProvider>
        </MotionConfig>
    );
}
