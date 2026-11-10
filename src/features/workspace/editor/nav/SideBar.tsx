"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { Tooltip } from "@/components/ui/tooltip";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { useEditor, type EditorTool } from "../EditorContext";
import { ElementsMenu } from "./ElementsMenu";
import { PencilIcon, SelectIcon, TextIcon } from "./icons";
import { ACTIVE_COLOR, IDLE_COLOR, toolButtonClass } from "./toolbar";

interface ToolItem {
    label: string;
    tool: EditorTool;
    shortcut?: string;
    icon: (color: string) => ReactNode;
}

const SELECT: ToolItem = {
    label: "Select",
    tool: "Select",
    icon: (color) => <SelectIcon width={25} height={25} strokeWidth={1.5} color={color} />,
};
const PEN: ToolItem = {
    label: "Pen",
    tool: "Pen",
    icon: (color) => <PencilIcon width={20} height={20} strokeWidth={1.5} color={color} />,
};
const TEXT: ToolItem = {
    label: "Text",
    tool: "Text",
    icon: (color) => <TextIcon width={25} height={25} strokeWidth={1} color={color} />,
};

function ToolButton({ item }: { item: ToolItem }) {
    const { tool, setTool } = useEditor();
    const active = tool === item.tool;

    return (
        <li>
            <Tooltip label={item.label} side="right">
                <button type="button" aria-label={item.label} aria-pressed={active} onClick={() => setTool(item.tool)} className={toolButtonClass(active)}>
                    {item.icon(active ? ACTIVE_COLOR : IDLE_COLOR)}
                </button>
            </Tooltip>
        </li>
    );
}

/** Floating tool rail on the left edge of the desktop viewer. */
export function SideNav() {
    return (
        <motion.div
            className="absolute top-1/2 left-8 z-10 hidden -translate-y-1/2 md:flex"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: DURATION.slow, ease: EASE_OUT }}
        >
            <nav aria-label="Tools" className="glass rounded-panel border border-line p-1 shadow-raised">
                <ul className="flex flex-col gap-0.5">
                    <ToolButton item={SELECT} />
                    <ToolButton item={PEN} />
                    <ElementsMenu />
                    <ToolButton item={TEXT} />
                </ul>
            </nav>
        </motion.div>
    );
}
