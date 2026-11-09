"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { useEditor, type EditorTool } from "../EditorContext";
import { ElementsMenu } from "./ElementsMenu";
import { PencilIcon, SelectIcon, TextIcon } from "./icons";
import { ACTIVE_COLOR, IDLE_COLOR, ToolTooltip, toolButtonClass } from "./toolbar";

interface ToolItem {
    label: string;
    tool: EditorTool;
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
    icon: (color) => <PencilIcon width={20} height={25} strokeWidth={1.5} color={color} />,
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
        <li className="group relative">
            <button type="button" aria-label={item.label} aria-pressed={active} onClick={() => setTool(item.tool)} className={toolButtonClass(active)}>
                {item.icon(active ? ACTIVE_COLOR : IDLE_COLOR)}
            </button>
            <ToolTooltip label={item.label} />
        </li>
    );
}

/** Floating tool bar on the left of the editor. */
export function SideNav() {
    return (
        <motion.div
            className="absolute left-8 top-1/2 z-10 hidden flex-col items-center justify-center gap-2 md:flex"
            initial={{ opacity: 0, translateX: -20, translateY: "-50%" }}
            animate={{ opacity: 1, translateX: 0, translateY: "-50%" }}
            exit={{ opacity: 0, translateX: -20 }}
            transition={{ duration: 0.5 }}
        >
            <nav aria-label="Tools" className="rounded-lg shadow-md">
                <ul className="flex flex-col rounded-lg bg-white shadow-sm">
                    <ToolButton item={SELECT} />
                    <ToolButton item={PEN} />
                    <ElementsMenu />
                    <ToolButton item={TEXT} />
                </ul>
            </nav>
        </motion.div>
    );
}
