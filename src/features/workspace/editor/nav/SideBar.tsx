"use client";

import type { ReactNode } from "react";

import { useEditor, type EditorTool } from "../EditorContext";
import { ElementsMenu } from "./ElementsMenu";
import { PencilIcon, SelectIcon, TextIcon } from "./icons";
import { ACTIVE_COLOR, IDLE_COLOR, ToolHighlight, ToolTooltip, toolButtonClass } from "./toolbar";

interface ToolItem {
    label: string;
    tool: EditorTool;
    icon: (color: string) => ReactNode;
}

const SELECT: ToolItem = {
    label: "Select",
    tool: "Select",
    icon: (color) => <SelectIcon width={24} height={24} strokeWidth={1.5} color={color} />,
};
const PEN: ToolItem = {
    label: "Pen",
    tool: "Pen",
    icon: (color) => <PencilIcon width={19} height={24} strokeWidth={1.5} color={color} />,
};
const TEXT: ToolItem = {
    label: "Text",
    tool: "Text",
    icon: (color) => <TextIcon width={24} height={24} strokeWidth={1} color={color} />,
};

function ToolButton({ item }: { item: ToolItem }) {
    const { tool, setTool } = useEditor();
    const active = tool === item.tool;

    return (
        <li className="group relative">
            <button type="button" aria-label={item.label} aria-pressed={active} onClick={() => setTool(item.tool)} className={toolButtonClass(active)}>
                {active && <ToolHighlight />}
                <span className="relative">{item.icon(active ? ACTIVE_COLOR : IDLE_COLOR)}</span>
            </button>
            <ToolTooltip label={item.label} />
        </li>
    );
}

/** Floating tool rail on the left edge of the desktop viewer. */
export function SideNav() {
    return (
        <div className="absolute left-4 top-1/2 z-10 hidden -translate-y-1/2 md:block">
            <nav aria-label="Tools" className="material-float rounded-2xl p-1.5">
                <ul className="flex flex-col gap-1">
                    <ToolButton item={SELECT} />
                    <ToolButton item={PEN} />
                    <ElementsMenu />
                    <ToolButton item={TEXT} />
                </ul>
            </nav>
        </div>
    );
}
